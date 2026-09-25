-- Esegui una sola volta dopo expense-document-type-migration.sql.

create table public.supplier_invoices (
  id bigint generated always as identity primary key,
  source_hash text not null unique,
  source_filename text not null,
  document_type text not null,
  invoice_number text not null,
  issue_date date not null,
  currency text not null default 'EUR',
  supplier_name text not null,
  supplier_vat_country text,
  supplier_vat_number text not null,
  supplier_tax_code text,
  supplier_address text,
  customer_name text not null,
  customer_vat_number text,
  customer_tax_code text,
  customer_address text,
  description text,
  taxable_cents integer not null check (taxable_cents >= 0),
  vat_cents integer not null check (vat_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  due_date date,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid')),
  paid_date date,
  payment_method text,
  expense_id bigint unique references public.expenses(id) on delete set null,
  imported_by uuid references auth.users(id) on delete set null default auth.uid(),
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_vat_number, invoice_number, issue_date),
  check (payment_status <> 'paid' or paid_date is not null)
);

create table public.supplier_invoice_lines (
  id bigint generated always as identity primary key,
  invoice_id bigint not null references public.supplier_invoices(id) on delete cascade,
  line_number integer not null,
  code text,
  description text not null,
  quantity numeric(14,4),
  unit text,
  unit_price_cents integer,
  total_cents integer not null,
  vat_rate numeric(6,2),
  unique(invoice_id,line_number)
);

create table public.supplier_invoice_vat_summaries (
  id bigint generated always as identity primary key,
  invoice_id bigint not null references public.supplier_invoices(id) on delete cascade,
  vat_rate numeric(6,2),
  taxable_cents integer not null,
  vat_cents integer not null,
  nature text
);

create index supplier_invoices_date_idx on public.supplier_invoices(issue_date desc);
create index supplier_invoices_due_idx on public.supplier_invoices(payment_status,due_date);
create trigger supplier_invoices_set_updated_at before update on public.supplier_invoices for each row execute procedure public.set_updated_at();

alter table public.supplier_invoices enable row level security;
alter table public.supplier_invoice_lines enable row level security;
alter table public.supplier_invoice_vat_summaries enable row level security;
grant select,insert,update,delete on public.supplier_invoices,public.supplier_invoice_lines,public.supplier_invoice_vat_summaries to authenticated;
grant usage,select on public.supplier_invoices_id_seq,public.supplier_invoice_lines_id_seq,public.supplier_invoice_vat_summaries_id_seq to authenticated;
create policy "Admins manage supplier invoices" on public.supplier_invoices for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage supplier invoice lines" on public.supplier_invoice_lines for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage supplier invoice VAT" on public.supplier_invoice_vat_summaries for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

insert into public.expense_categories(name,cost_type,color,monthly_budget_cents,is_active)
values ('Fatture fornitori','variable','#7C3AED',0,true)
on conflict (name) do nothing;
