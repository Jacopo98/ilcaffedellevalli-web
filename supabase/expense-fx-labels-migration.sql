-- Esegui una sola volta dopo daily-closing-details-migration.sql.
-- Aggiunge la classificazione gestionale F/X richiesta per spese e costi fissi.

alter table public.expenses
  add column if not exists accounting_label text not null default 'F'
    check (accounting_label in ('F', 'X'));

alter table public.recurring_cost_plans
  add column if not exists accounting_label text not null default 'F'
    check (accounting_label in ('F', 'X'));

comment on column public.expenses.accounting_label is 'Etichetta gestionale F oppure X.';
comment on column public.recurring_cost_plans.accounting_label is 'Etichetta gestionale F oppure X, conservata nelle versioni del costo.';
