-- Esegui una sola volta dopo supplier-invoices-migration.sql.
-- Conserva tutti i dettagli di pagamento presenti nella FatturaPA, incluse eventuali rate.

create table public.supplier_invoice_payments (
  id bigint generated always as identity primary key,
  invoice_id bigint not null references public.supplier_invoices(id) on delete cascade,
  payment_group_number integer not null default 1,
  installment_number integer not null default 1,
  payment_terms text,
  method_code text,
  due_date date,
  reference_date date,
  payment_days integer,
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  beneficiary text,
  bank_name text,
  iban text,
  abi text,
  cab text,
  bic text,
  postal_office_code text,
  payee_first_name text,
  payee_last_name text,
  payee_tax_code text,
  payee_title text,
  payment_code text,
  discount_cents integer check (discount_cents is null or discount_cents >= 0),
  early_discount_due_date date,
  penalty_cents integer check (penalty_cents is null or penalty_cents >= 0),
  penalty_due_date date,
  created_at timestamptz not null default now(),
  unique (invoice_id, payment_group_number, installment_number)
);

create index supplier_invoice_payments_invoice_idx
  on public.supplier_invoice_payments (invoice_id, due_date);

create index supplier_invoice_payments_method_idx
  on public.supplier_invoice_payments (method_code);

alter table public.supplier_invoice_payments enable row level security;

grant select, insert, update, delete on public.supplier_invoice_payments to authenticated;
grant usage, select on public.supplier_invoice_payments_id_seq to authenticated;

create policy "Admins manage supplier invoice payments"
on public.supplier_invoice_payments
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

comment on table public.supplier_invoice_payments is
  'Dettagli e rate di pagamento estratti dai blocchi DatiPagamento della FatturaPA.';
