-- Esegui una sola volta DOPO expenses-setup.sql.
-- Estende la gestione spese senza eliminare o modificare i movimenti esistenti.

create table if not exists public.recurring_cost_plans (
  id bigint generated always as identity primary key,
  category_id bigint references public.expense_categories(id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  supplier text,
  annual_amount_cents integer check (annual_amount_cents is null or annual_amount_cents >= 0),
  competence_start date not null,
  competence_end date,
  payment_frequency text not null check (payment_frequency in ('monthly','bimonthly','quarterly','yearly','custom')),
  payment_months smallint[] not null default '{}',
  payment_day smallint not null default 1 check (payment_day between 1 and 28),
  payment_method text check (payment_method is null or payment_method in ('bank_transfer','direct_debit','card','cash','other')),
  is_estimate boolean not null default true,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (competence_end >= competence_start)
);

create table if not exists public.cost_plan_months (
  id bigint generated always as identity primary key,
  plan_id bigint not null references public.recurring_cost_plans(id) on delete cascade,
  competence_month date not null check (extract(day from competence_month) = 1),
  competence_amount_cents integer check (competence_amount_cents is null or competence_amount_cents >= 0),
  due_date date,
  cash_amount_cents integer check (cash_amount_cents is null or cash_amount_cents >= 0),
  status text not null default 'planned' check (status in ('planned','confirmed','paid')),
  paid_date date,
  expense_id bigint references public.expenses(id) on delete set null,
  notes text,
  unique(plan_id, competence_month),
  check (status <> 'paid' or paid_date is not null)
);

create table if not exists public.daily_revenues (
  id bigint generated always as identity primary key,
  revenue_date date not null unique,
  cash_cents integer not null default 0 check (cash_cents >= 0),
  pos_cents integer not null default 0 check (pos_cents >= 0),
  other_cents integer not null default 0 check (other_cents >= 0),
  refunds_cents integer not null default 0 check (refunds_cents >= 0),
  receipt_count integer check (receipt_count is null or receipt_count >= 0),
  notes text,
  is_closed boolean not null default false,
  closed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.financial_period_closures (
  id bigint generated always as identity primary key,
  period_type text not null check (period_type in ('month')),
  period_start date not null,
  closed_at timestamptz not null default now(),
  closed_by uuid references auth.users(id) on delete set null default auth.uid(),
  notes text,
  unique(period_type, period_start)
);

drop trigger if exists recurring_cost_plans_set_updated_at on public.recurring_cost_plans;
create trigger recurring_cost_plans_set_updated_at before update on public.recurring_cost_plans for each row execute procedure public.set_updated_at();
drop trigger if exists daily_revenues_set_updated_at on public.daily_revenues;
create trigger daily_revenues_set_updated_at before update on public.daily_revenues for each row execute procedure public.set_updated_at();

alter table public.recurring_cost_plans enable row level security;
alter table public.cost_plan_months enable row level security;
alter table public.daily_revenues enable row level security;
alter table public.financial_period_closures enable row level security;

grant select, insert, update, delete on public.recurring_cost_plans, public.cost_plan_months, public.daily_revenues, public.financial_period_closures to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create policy "Admins manage recurring plans" on public.recurring_cost_plans for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage cost plan months" on public.cost_plan_months for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage daily revenues" on public.daily_revenues for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage financial closures" on public.financial_period_closures for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- Piano iniziale 01/09/2026 - 31/08/2027. Le cifre mancanti restano NULL e non entrano nei totali.
insert into public.recurring_cost_plans (category_id,name,annual_amount_cents,competence_start,competence_end,payment_frequency,payment_months,payment_day,payment_method,is_estimate,notes)
select c.id, v.name, v.amount, '2026-09-01', '2027-08-31', v.frequency, v.months, v.day, v.method, true, v.notes
from (values
 ('Affitto locale',2800000,'quarterly',array[9,12,3,6]::smallint[],1,'bank_transfer','Quattro rate da 7.000 euro'),
 ('Energia elettrica',780000,'bimonthly',array[9,11,1,3,5,7]::smallint[],15,'bank_transfer','Stima 1.300 euro bimestrali; verificare il ciclo fattura'),
 ('Gas e riscaldamento',96000,'monthly',array[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[],15,'direct_debit','Stima 80 euro mensili'),
 ('Personale e consulenza paghe',200000,'yearly',array[]::smallint[],1,null,'Periodicita e data da confermare'),
 ('Commercialista e consulenze',null,'custom',array[]::smallint[],1,null,'Da stimare'),
 ('Assicurazioni',null,'yearly',array[]::smallint[],1,null,'Da stimare'),
 ('Canone RAI',null,'yearly',array[]::smallint[],1,null,'Da stimare'),
 ('TARI',null,'custom',array[]::smallint[],1,null,'Da stimare'),
 ('SIAE',null,'yearly',array[]::smallint[],1,null,'Da stimare'),
 ('Diritti insegna',null,'yearly',array[]::smallint[],1,null,'Da stimare'),
 ('Stipendi dipendenti',null,'monthly',array[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[],27,'bank_transfer','Inserire il costo aziendale mensile effettivo')
) as v(name,amount,frequency,months,day,method,notes)
left join public.expense_categories c on c.name = v.name
where not exists (select 1 from public.recurring_cost_plans p where p.name = v.name and p.competence_start = '2026-09-01');

-- Genera dodici righe di competenza; distribuisce i centesimi mantenendo esatto il totale annuo.
insert into public.cost_plan_months (plan_id,competence_month,competence_amount_cents,due_date,cash_amount_cents)
select p.id, m.month_start,
  case when p.annual_amount_cents is null then null else (p.annual_amount_cents / 12) + case when m.n <= (p.annual_amount_cents % 12) then 1 else 0 end end,
  case when extract(month from m.month_start)::smallint = any(p.payment_months) and p.annual_amount_cents is not null then make_date(extract(year from m.month_start)::int,extract(month from m.month_start)::int,p.payment_day) end,
  case when extract(month from m.month_start)::smallint = any(p.payment_months) and cardinality(p.payment_months) > 0 and p.annual_amount_cents is not null then p.annual_amount_cents / cardinality(p.payment_months) end
from public.recurring_cost_plans p
cross join lateral (select generate_series(1,12) n, ('2026-09-01'::date + (generate_series(0,11) || ' months')::interval)::date month_start) m
where p.competence_start = '2026-09-01'
on conflict (plan_id,competence_month) do nothing;
