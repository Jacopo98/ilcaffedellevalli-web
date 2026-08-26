-- Esegui una sola volta dopo finance-management-migration.sql e workforce-notifications-migration.sql.
-- Introduce versioni dei costi fissi e chiusura mensile dello storico.

alter table public.recurring_cost_plans add column if not exists series_id uuid;
alter table public.recurring_cost_plans add column if not exists version_number integer not null default 1 check (version_number > 0);
alter table public.recurring_cost_plans add column if not exists replaced_at timestamptz;
alter table public.recurring_cost_plans add column if not exists replaced_by bigint references public.recurring_cost_plans(id) on delete set null;
update public.recurring_cost_plans set series_id = gen_random_uuid() where series_id is null;
alter table public.recurring_cost_plans alter column series_id set not null;
create unique index if not exists recurring_cost_plan_version_idx on public.recurring_cost_plans(series_id,version_number);

alter table public.cost_plan_months add column if not exists confirmed_at timestamptz;
alter table public.cost_plan_months add column if not exists confirmed_by uuid references auth.users(id) on delete set null;

create or replace function private.month_is_closed(value date)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.financial_period_closures
    where period_type = 'month' and period_start = date_trunc('month', value)::date
  );
$$;
revoke all on function private.month_is_closed(date) from public;
grant execute on function private.month_is_closed(date) to authenticated;

create or replace function private.protect_closed_cost_month()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_month date;
begin
  target_month := coalesce(new.competence_month, old.competence_month);
  if private.month_is_closed(target_month) then
    raise exception 'Il mese % è chiuso. Riaprilo prima di modificare i dati.', to_char(target_month,'MM/YYYY') using errcode='P0001';
  end if;
  return coalesce(new,old);
end;
$$;

create or replace function private.protect_closed_expense()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.month_is_closed(coalesce(new.expense_date,old.expense_date)) then raise exception 'Periodo chiuso' using errcode='P0001'; end if;
  return coalesce(new,old);
end; $$;

create or replace function private.protect_closed_revenue()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.month_is_closed(coalesce(new.revenue_date,old.revenue_date)) then raise exception 'Periodo chiuso' using errcode='P0001'; end if;
  return coalesce(new,old);
end; $$;

create or replace function private.protect_closed_staff_cost()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.month_is_closed(coalesce(new.competence_month,old.competence_month)) then raise exception 'Periodo chiuso' using errcode='P0001'; end if;
  return coalesce(new,old);
end; $$;

drop trigger if exists protect_closed_cost_month on public.cost_plan_months;
create trigger protect_closed_cost_month before update or delete on public.cost_plan_months for each row execute procedure private.protect_closed_cost_month();
drop trigger if exists protect_closed_expense on public.expenses;
create trigger protect_closed_expense before update or delete on public.expenses for each row execute procedure private.protect_closed_expense();
drop trigger if exists protect_closed_revenue on public.daily_revenues;
create trigger protect_closed_revenue before update or delete on public.daily_revenues for each row execute procedure private.protect_closed_revenue();
drop trigger if exists protect_closed_staff_cost on public.employee_monthly_costs;
create trigger protect_closed_staff_cost before update or delete on public.employee_monthly_costs for each row execute procedure private.protect_closed_staff_cost();
