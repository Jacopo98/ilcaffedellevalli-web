-- Esegui una sola volta dopo employees-setup.sql e workforce-notifications-migration.sql.

alter table public.profiles add column if not exists employee_id bigint references public.employees(id) on delete set null;
create unique index if not exists profiles_employee_id_unique on public.profiles(employee_id) where employee_id is not null;

alter table public.work_shifts
  add column if not exists approval_status text not null default 'approved' check (approval_status in ('pending', 'approved', 'rejected')),
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null;
create index if not exists work_shifts_approval_idx on public.work_shifts(approval_status, shift_date);

grant update (employee_id) on public.profiles to authenticated;
drop policy if exists "Admins can link employee accounts" on public.profiles;
create policy "Admins can link employee accounts" on public.profiles for update to authenticated
using ((select private.is_admin())) with check (role = 'employee');

create or replace function private.current_employee_id()
returns bigint language sql stable security definer set search_path = '' as $$
  select employee_id from public.profiles where id = (select auth.uid()) and role = 'employee';
$$;
revoke all on function private.current_employee_id() from public;
grant execute on function private.current_employee_id() to authenticated;

drop policy if exists "Employees can read their record" on public.employees;
create policy "Employees can read their record" on public.employees for select to authenticated
using (id = (select private.current_employee_id()));

drop policy if exists "Employees can read their shifts" on public.work_shifts;
create policy "Employees can read their shifts" on public.work_shifts for select to authenticated
using (employee_id = (select private.current_employee_id()));

drop policy if exists "Employees can request extra hours" on public.work_shifts;
create policy "Employees can request extra hours" on public.work_shifts for insert to authenticated
with check (
  employee_id = (select private.current_employee_id())
  and entry_type = 'extra'
  and approval_status = 'pending'
  and shift_date >= current_date
  and actual_start_time is null
  and actual_end_time is null
  and break_minutes = 0
  and approved_at is null
  and approved_by is null
);

comment on column public.profiles.employee_id is 'Anagrafica dipendente associata all account di accesso.';
comment on column public.work_shifts.approval_status is 'Le ore extra inserite dal dipendente restano pending fino alla decisione admin.';
