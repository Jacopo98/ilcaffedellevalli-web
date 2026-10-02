-- Esegui una sola volta dopo supplier-invoices-migration.sql.
-- Conserva tutti i dettagli di pagamento presenti nella FatturaPA, incluse eventuali rate.

create table if not exists public.supplier_invoice_payments (
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

-- Completa in sicurezza anche una tabella creata con una versione precedente.
alter table public.supplier_invoice_payments
  add column if not exists payment_group_number integer not null default 1,
  add column if not exists installment_number integer not null default 1,
  add column if not exists payment_terms text,
  add column if not exists method_code text,
  add column if not exists due_date date,
  add column if not exists reference_date date,
  add column if not exists payment_days integer,
  add column if not exists amount_cents integer,
  add column if not exists beneficiary text,
  add column if not exists bank_name text,
  add column if not exists iban text,
  add column if not exists abi text,
  add column if not exists cab text,
  add column if not exists bic text,
  add column if not exists postal_office_code text,
  add column if not exists payee_first_name text,
  add column if not exists payee_last_name text,
  add column if not exists payee_tax_code text,
  add column if not exists payee_title text,
  add column if not exists payment_code text,
  add column if not exists discount_cents integer,
  add column if not exists early_discount_due_date date,
  add column if not exists penalty_cents integer,
  add column if not exists penalty_due_date date,
  add column if not exists created_at timestamptz not null default now();

create index if not exists supplier_invoice_payments_invoice_idx
  on public.supplier_invoice_payments (invoice_id, due_date);

create index if not exists supplier_invoice_payments_method_idx
  on public.supplier_invoice_payments (method_code);

alter table public.supplier_invoice_payments enable row level security;

grant select, insert, update, delete on public.supplier_invoice_payments to authenticated;
grant usage, select on public.supplier_invoice_payments_id_seq to authenticated;

drop policy if exists "Admins manage supplier invoice payments"
on public.supplier_invoice_payments;

create policy "Admins manage supplier invoice payments"
on public.supplier_invoice_payments
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

comment on table public.supplier_invoice_payments is
  'Dettagli e rate di pagamento estratti dai blocchi DatiPagamento della FatturaPA.';
