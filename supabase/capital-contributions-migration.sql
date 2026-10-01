-- Esegui una sola volta dopo finance-management-migration.sql.
-- Aggiunge versamenti soci e classificazione delle spese di avvio senza modificare i dati esistenti.

alter table public.expenses
  add column if not exists is_startup_cost boolean not null default false;

create table if not exists public.capital_contributions (
  id bigint generated always as identity primary key,
  contribution_date date not null,
  contributor_name text not null check (char_length(contributor_name) between 1 and 120),
  contribution_type text not null default 'additional'
    check (contribution_type in ('initial','additional')),
  amount_cents integer not null check (amount_cents > 0),
  payment_method text check (payment_method is null or payment_method in ('bank_transfer','cash','other')),
  reference text check (reference is null or char_length(reference) <= 160),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists capital_contributions_date_idx
  on public.capital_contributions (contribution_date desc);

drop trigger if exists capital_contributions_set_updated_at on public.capital_contributions;
create trigger capital_contributions_set_updated_at
before update on public.capital_contributions
for each row execute procedure public.set_updated_at();

alter table public.capital_contributions enable row level security;

grant select, insert, update, delete on public.capital_contributions to authenticated;
grant usage, select on sequence public.capital_contributions_id_seq to authenticated;

drop policy if exists "Admins manage capital contributions" on public.capital_contributions;
create policy "Admins manage capital contributions"
on public.capital_contributions
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

comment on table public.capital_contributions is
  'Versamenti patrimoniali dei soci, separati dagli incassi operativi.';
comment on column public.expenses.is_startup_cost is
  'Contrassegna una spesa sostenuta per l avvio dell attivita.';
