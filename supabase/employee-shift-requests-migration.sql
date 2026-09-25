-- Esegui una sola volta dopo employee-portal-migration.sql.

create table if not exists public.shift_change_requests (
  id bigint generated always as identity primary key,
  employee_id bigint not null references public.employees(id) on delete cascade,
  work_shift_id bigint references public.work_shifts(id) on delete cascade,
  request_type text not null check (request_type in ('add_extra','change_shift')),
  original_date date,
  original_start_time time,
  original_end_time time,
  proposed_date date not null,
  proposed_start_time time not null,
  proposed_end_time time not null,
  notes text check (notes is null or char_length(notes) <= 500),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (proposed_end_time > proposed_start_time),
  check ((request_type = 'add_extra' and work_shift_id is null) or (request_type = 'change_shift' and work_shift_id is not null))
);

create index if not exists shift_change_requests_week_idx on public.shift_change_requests(proposed_date, status);
create unique index if not exists one_pending_change_per_shift on public.shift_change_requests(work_shift_id) where status = 'pending' and work_shift_id is not null;
alter table public.shift_change_requests enable row level security;
grant select,insert,update,delete on public.shift_change_requests to authenticated;
grant usage,select on sequence public.shift_change_requests_id_seq to authenticated;

drop policy if exists "Admins manage shift requests" on public.shift_change_requests;
create policy "Admins manage shift requests" on public.shift_change_requests for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists "Employees read own shift requests" on public.shift_change_requests;
create policy "Employees read own shift requests" on public.shift_change_requests for select to authenticated
using (employee_id = (select private.current_employee_id()));

drop policy if exists "Employees create own shift requests" on public.shift_change_requests;
create policy "Employees create own shift requests" on public.shift_change_requests for insert to authenticated
with check (
  employee_id = (select private.current_employee_id())
  and requested_by = (select auth.uid())
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
  and proposed_date >= current_date
  and (
    (request_type = 'add_extra' and work_shift_id is null)
    or
    (request_type = 'change_shift' and work_shift_id in (
      select id from public.work_shifts where employee_id = (select private.current_employee_id())
    ))
  )
);

comment on table public.shift_change_requests is 'Richieste dipendenti che non modificano i turni reali fino all approvazione admin.';
