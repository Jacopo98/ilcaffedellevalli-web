-- Esegui una sola volta dopo supplier-invoices-migration.sql.
-- Aggiunge le note gestionali all'archivio fatture.

alter table public.supplier_invoices
  add column if not exists notes text;

comment on column public.supplier_invoices.notes is
  'Note gestionali modificabili associate alla fattura.';

