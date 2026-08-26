-- Esegui una sola volta, dopo admin-setup.sql.

create table public.expense_categories (
  id bigint generated always as identity primary key,
  name text not null unique check (char_length(name) between 1 and 80),
  cost_type text not null check (cost_type in ('fixed', 'variable')),
  color text not null default '#E8650A' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  monthly_budget_cents integer not null default 0 check (monthly_budget_cents >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expenses (
  id bigint generated always as identity primary key,
  category_id bigint not null references public.expense_categories(id) on delete restrict,
  description text not null check (char_length(description) between 1 and 160),
  supplier text check (supplier is null or char_length(supplier) <= 120),
  invoice_number text check (invoice_number is null or char_length(invoice_number) <= 80),
  expense_date date not null default current_date,
  due_date date,
  paid_date date,
  amount_net_cents integer not null check (amount_net_cents >= 0),
  vat_cents integer not null default 0 check (vat_cents >= 0),
  total_cents integer generated always as (amount_net_cents + vat_cents) stored,
  payment_status text not null default 'due' check (payment_status in ('planned', 'due', 'paid')),
  payment_method text check (payment_method is null or payment_method in ('bank_transfer', 'direct_debit', 'card', 'cash', 'other')),
  recurrence text not null default 'none' check (recurrence in ('none', 'monthly', 'bimonthly', 'quarterly', 'yearly')),
  is_estimate boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 1000),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (payment_status <> 'paid' or paid_date is not null)
);

create index expenses_date_idx on public.expenses (expense_date desc);
create index expenses_due_idx on public.expenses (payment_status, due_date);
create index expenses_category_idx on public.expenses (category_id, expense_date);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger expense_categories_set_updated_at before update on public.expense_categories
for each row execute procedure public.set_updated_at();

create trigger expenses_set_updated_at before update on public.expenses
for each row execute procedure public.set_updated_at();

alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;

grant select, insert, update, delete on public.expense_categories to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;
grant usage, select on sequence public.expense_categories_id_seq to authenticated;
grant usage, select on sequence public.expenses_id_seq to authenticated;

create policy "Admins can manage expense categories" on public.expense_categories
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Admins can manage expenses" on public.expenses
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

insert into public.expense_categories (name, cost_type, color, monthly_budget_cents) values
  ('Affitto locale', 'fixed', '#7C5CFC', 150000),
  ('Energia elettrica', 'variable', '#D49B26', 90000),
  ('Gas e riscaldamento', 'variable', '#E8650A', 35000),
  ('Acqua', 'variable', '#3978C5', 15000),
  ('Internet e telefono', 'fixed', '#5B6B7A', 8000),
  ('Commercialista e consulenze', 'fixed', '#8B6547', 30000),
  ('Personale e consulenza paghe', 'fixed', '#D94F70', 70000),
  ('Materie prime', 'variable', '#248A73', 350000),
  ('Pulizia e consumabili', 'variable', '#4F8C89', 45000),
  ('Manutenzione attrezzature', 'variable', '#A66B44', 30000),
  ('Assicurazioni', 'fixed', '#6B7280', 20000),
  ('Canoni software e POS', 'fixed', '#3B82A0', 18000),
  ('Marketing', 'variable', '#C45A86', 25000),
  ('Tasse e diritti', 'fixed', '#7A5B3A', 25000),
  ('Altro', 'variable', '#9A9A94', 20000);

-- Dati dimostrativi del mese corrente: sono marcati come stime e possono essere modificati o eliminati.
insert into public.expenses (category_id, description, supplier, expense_date, due_date, paid_date, amount_net_cents, vat_cents, payment_status, recurrence, is_estimate, notes)
values
  ((select id from public.expense_categories where name = 'Affitto locale'), 'Canone mensile locale', 'Proprietà immobile', date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '4 days')::date, null, 150000, 0, 'planned', 'monthly', true, 'Valore dimostrativo'),
  ((select id from public.expense_categories where name = 'Energia elettrica'), 'Fornitura energia', 'Fornitore energia', (date_trunc('month', current_date) + interval '5 days')::date, (date_trunc('month', current_date) + interval '20 days')::date, null, 72000, 15840, 'due', 'monthly', true, 'Valore dimostrativo'),
  ((select id from public.expense_categories where name = 'Internet e telefono'), 'Connettività e linea telefonica', 'Operatore telefonico', (date_trunc('month', current_date) + interval '2 days')::date, (date_trunc('month', current_date) + interval '12 days')::date, (date_trunc('month', current_date) + interval '3 days')::date, 6557, 1443, 'paid', 'monthly', true, 'Valore dimostrativo'),
  ((select id from public.expense_categories where name = 'Materie prime'), 'Caffè, latte e bevande', 'Fornitore bar', (date_trunc('month', current_date) + interval '7 days')::date, (date_trunc('month', current_date) + interval '14 days')::date, (date_trunc('month', current_date) + interval '8 days')::date, 98000, 9800, 'paid', 'none', true, 'Valore dimostrativo'),
  ((select id from public.expense_categories where name = 'Materie prime'), 'Brioches e prodotti da forno', 'Laboratorio dolciario', (date_trunc('month', current_date) + interval '10 days')::date, (date_trunc('month', current_date) + interval '17 days')::date, null, 62000, 6200, 'due', 'none', true, 'Valore dimostrativo'),
  ((select id from public.expense_categories where name = 'Pulizia e consumabili'), 'Detergenti, carta e monouso', 'Grossista horeca', (date_trunc('month', current_date) + interval '9 days')::date, (date_trunc('month', current_date) + interval '16 days')::date, null, 28000, 6160, 'due', 'none', true, 'Valore dimostrativo'),
  ((select id from public.expense_categories where name = 'Canoni software e POS'), 'Gestionale e terminale POS', 'Servizi digitali', (date_trunc('month', current_date) + interval '1 day')::date, (date_trunc('month', current_date) + interval '10 days')::date, (date_trunc('month', current_date) + interval '2 days')::date, 14754, 3246, 'paid', 'monthly', true, 'Valore dimostrativo');
