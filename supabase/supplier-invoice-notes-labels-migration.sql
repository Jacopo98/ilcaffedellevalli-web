-- Esegui una sola volta dopo supplier-invoices-migration.sql.
-- Aggiunge note gestionali ed etichette filtrabili all'archivio fatture.

alter table public.supplier_invoices
  add column if not exists notes text,
  add column if not exists tracking_label text;

alter table public.supplier_invoices
  drop constraint if exists supplier_invoices_tracking_label_check;

alter table public.supplier_invoices
  add constraint supplier_invoices_tracking_label_check
  check (tracking_label is null or tracking_label in ('#TOPAY', '#???', '#ATTENTION'));

create index if not exists supplier_invoices_tracking_label_idx
  on public.supplier_invoices (tracking_label, issue_date desc);

comment on column public.supplier_invoices.notes is
  'Note gestionali modificabili associate alla fattura.';

comment on column public.supplier_invoices.tracking_label is
  'Etichetta gestionale facoltativa: #TOPAY, #??? oppure #ATTENTION.';
