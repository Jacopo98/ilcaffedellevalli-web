-- Esegui una sola volta nel SQL Editor di Supabase, dopo daily-service-metrics-migration.sql.
-- Estende la chiusura giornaliera senza modificare i dati già registrati.

alter table public.daily_revenues
  add column if not exists issued_invoices_cents integer not null default 0
    check (issued_invoices_cents >= 0),
  add column if not exists cash_expenses jsonb not null default '[]'::jsonb
    check (jsonb_typeof(cash_expenses) = 'array');

comment on column public.daily_revenues.issued_invoices_cents is
  'Importo delle fatture emesse nella giornata, tracciato separatamente dal totale incasso.';

comment on column public.daily_revenues.cash_expenses is
  'Spese prelevate dal cassetto nella giornata. Array JSON di oggetti con category e amount_cents.';
