-- Esegui una sola volta dopo employees-setup.sql e finance-management-migration.sql.

alter table public.work_shifts drop constraint if exists work_shifts_entry_type_check;
alter table public.work_shifts add constraint work_shifts_entry_type_check
check (entry_type in ('work','extra','rol','holiday','sick'));
comment on column public.work_shifts.entry_type is 'work=lavoro base, extra=ore extra, rol=ROL, holiday=ferie, sick=malattia';

create table public.employee_monthly_costs (
  id bigint generated always as identity primary key,
  employee_id bigint not null references public.employees(id) on delete cascade,
  competence_month date not null check (extract(day from competence_month)=1),
  scheduled_base_hours numeric(7,2) not null default 0 check (scheduled_base_hours>=0),
  scheduled_extra_hours numeric(7,2) not null default 0 check (scheduled_extra_hours>=0),
  confirmed_base_hours numeric(7,2) not null default 0 check (confirmed_base_hours>=0),
  confirmed_extra_hours numeric(7,2) not null default 0 check (confirmed_extra_hours>=0),
  base_hourly_rate_cents integer not null default 0 check (base_hourly_rate_cents>=0),
  extra_hourly_rate_cents integer not null default 0 check (extra_hourly_rate_cents>=0),
  status text not null default 'draft' check (status in ('draft','confirmed')),
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(employee_id,competence_month)
);

create table public.admin_notifications (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('payment_due','note','system')),
  title text not null check (char_length(title) between 1 and 160),
  message text check (message is null or char_length(message)<=2000),
  due_date date,
  priority text not null default 'normal' check (priority in ('normal','high')),
  fingerprint text unique,
  is_read boolean not null default false,
  read_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.notification_email_log (
  id bigint generated always as identity primary key,
  sent_date date not null,
  fingerprint text not null,
  recipient text not null,
  sent_at timestamptz not null default now(),
  unique(sent_date,fingerprint,recipient)
);

create trigger employee_monthly_costs_set_updated_at before update on public.employee_monthly_costs for each row execute procedure public.set_updated_at();
alter table public.employee_monthly_costs enable row level security;
alter table public.admin_notifications enable row level security;
alter table public.notification_email_log enable row level security;
grant select,insert,update,delete on public.employee_monthly_costs,public.admin_notifications,public.notification_email_log to authenticated;
grant usage,select on all sequences in schema public to authenticated;
create policy "Admins manage employee costs" on public.employee_monthly_costs for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage notifications" on public.admin_notifications for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage notification email log" on public.notification_email_log for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
