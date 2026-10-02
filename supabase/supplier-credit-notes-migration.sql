-- Esegui una sola volta dopo supplier-invoices-migration.sql.
-- Permette alle note di credito importate di ridurre i costi nei riepiloghi.

alter table public.expenses
  drop constraint if exists expenses_amount_net_cents_check;

alter table public.expenses
  drop constraint if exists expenses_vat_cents_check;

comment on column public.expenses.amount_net_cents is
  'Imponibile con segno gestionale: negativo per note di credito importate.';

comment on column public.expenses.vat_cents is
  'IVA con segno gestionale: negativa per note di credito importate.';
