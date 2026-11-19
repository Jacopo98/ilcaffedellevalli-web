-- Esegui una sola volta dopo supplier-invoice-notes-labels-migration.sql.
-- Rimuove le vecchie etichette e introduce lo stato per i pagamenti automatici.

alter table public.supplier_invoices
  drop constraint if exists supplier_invoices_tracking_label_check;

drop index if exists public.supplier_invoices_tracking_label_idx;

alter table public.supplier_invoices
  drop column if exists tracking_label;

alter table public.supplier_invoices
  drop constraint if exists supplier_invoices_payment_status_check;

alter table public.supplier_invoices
  add constraint supplier_invoices_payment_status_check
  check (payment_status in ('unpaid', 'automatic', 'paid'));

-- Allinea anche le fatture già importate, ma soltanto quando tutti i metodi
-- presenti sono inequivocabilmente automatici (RIBA o SEPA).
update public.supplier_invoices as invoice
set payment_status = 'automatic'
where invoice.payment_status = 'unpaid'
  and exists (
    select 1 from public.supplier_invoice_payments as payment
    where payment.invoice_id = invoice.id
  )
  and not exists (
    select 1 from public.supplier_invoice_payments as payment
    where payment.invoice_id = invoice.id
      and (payment.method_code is null or payment.method_code not in ('MP12', 'MP19', 'MP20', 'MP21'))
  );

comment on column public.supplier_invoices.payment_status is
  'unpaid=da gestire, automatic=RIBA o SEPA automatico, paid=pagata';

