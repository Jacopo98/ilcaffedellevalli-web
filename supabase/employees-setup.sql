-- Esegui questo file dopo supabase/admin-setup.sql nel SQL Editor di Supabase.

create extension if not exists btree_gist;

create table public.employees (
  id bigint generated always as identity primary key,
  first_name text not null check (char_length(first_name) between 1 and 60),
  last_name text not null default '' check (char_length(last_name) <= 60),
  phone text check (phone is null or char_length(phone) <= 30),
  email text check (email is null or char_length(email) <= 254),
  role_title text not null default 'Collaboratore' check (char_length(role_title) <= 80),
  hire_date date,
  weekly_contract_hours numeric(5,2) check (weekly_contract_hours is null or weekly_contract_hours between 0 and 168),
  notes text check (notes is null or char_length(notes) <= 1000),
  color text not null default '#E8650A' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (first_name, last_name)
);

create table public.work_shifts (
  id bigint generated always as identity primary key,
  employee_id bigint not null references public.employees(id) on delete restrict,
  entry_type text not null default 'work' check (entry_type in ('work', 'rol', 'holiday', 'sick')),
  shift_date date not null,
  start_time time not null,
  end_time time not null,
  actual_start_time time,
  actual_end_time time,
  break_minutes integer not null default 0 check (break_minutes between 0 and 720),
  notes text check (notes is null or char_length(notes) <= 500),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  check ((actual_start_time is null and actual_end_time is null) or (actual_start_time is not null and actual_end_time > actual_start_time)),
  check (break_minutes < extract(epoch from (end_time - start_time)) / 60),
  exclude using gist (
    employee_id with =,
    shift_date with =,
    int4range(
      (extract(epoch from start_time) / 60)::integer,
      (extract(epoch from end_time) / 60)::integer,
      '[)'
    ) with &&
  )
);

create index work_shifts_week_idx on public.work_shifts (shift_date, employee_id);
create index employees_active_idx on public.employees (is_active, first_name);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger employees_set_updated_at
before update on public.employees
for each row execute procedure public.set_updated_at();

create trigger work_shifts_set_updated_at
before update on public.work_shifts
for each row execute procedure public.set_updated_at();

alter table public.employees enable row level security;
alter table public.work_shifts enable row level security;

grant select, insert, update, delete on public.employees to authenticated;
grant select, insert, update, delete on public.work_shifts to authenticated;
grant usage, select on sequence public.employees_id_seq to authenticated;
grant usage, select on sequence public.work_shifts_id_seq to authenticated;

create policy "Admins can manage employees"
on public.employees
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admins can manage work shifts"
on public.work_shifts
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

insert into public.employees (first_name, color)
values
  ('Lorenzo', '#E8650A'),
  ('Barbara', '#7C5CFC'),
  ('Carola', '#D94F70'),
  ('Hellen', '#248A73'),
  ('Giorgia', '#D49B26'),
  ('Martina', '#3978C5'),
  ('Gianmauro', '#8B6547')
on conflict (first_name, last_name) do nothing;
