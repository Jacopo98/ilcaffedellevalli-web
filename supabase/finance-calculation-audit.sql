-- Query diagnostica in sola lettura: non crea, aggiorna o elimina dati.
-- Il primo risultato riconcilia entrate, uscite e risultato per ogni mese.
-- Il secondo risultato elenca soltanto eventuali anomalie da controllare.

with months as (
  select date_trunc('month', revenue_date)::date as month from public.daily_revenues
  union
  select date_trunc('month', expense_date)::date from public.expenses
  union
  select date_trunc('month', contribution_date)::date from public.capital_contributions
), revenues as (
  select date_trunc('month', revenue_date)::date as month,
         sum(register_total_cents)::bigint as register_cents
  from public.daily_revenues
  group by 1
), contributions as (
  select date_trunc('month', contribution_date)::date as month,
         sum(amount_cents)::bigint as contribution_cents
  from public.capital_contributions
  group by 1
), expenses as (
  select date_trunc('month', expense_date)::date as month,
         sum(total_cents)::bigint as expense_cents
  from public.expenses
  group by 1
)
select
  months.month,
  coalesce(revenues.register_cents, 0) as chiusure_registratore_cents,
  coalesce(contributions.contribution_cents, 0) as versamenti_soci_cents,
  coalesce(revenues.register_cents, 0) + coalesce(contributions.contribution_cents, 0) as entrate_totali_cents,
  coalesce(expenses.expense_cents, 0) as uscite_totali_cents,
  coalesce(revenues.register_cents, 0) + coalesce(contributions.contribution_cents, 0) - coalesce(expenses.expense_cents, 0) as risultato_cents
from months
left join revenues using (month)
left join contributions using (month)
left join expenses using (month)
order by months.month desc;

with invoice_checks as (
  select
    invoice.id,
    invoice.invoice_number,
    invoice.supplier_name,
    invoice.payment_status,
    invoice.expense_id,
    invoice.total_cents,
    invoice.document_type,
    expense.total_cents as linked_expense_cents,
    exists (
      select 1 from public.supplier_invoice_payments payment
      where payment.invoice_id = invoice.id
    ) as has_payment_details,
    exists (
      select 1 from public.supplier_invoice_payments payment
      where payment.invoice_id = invoice.id
        and (payment.method_code is null or payment.method_code not in ('MP12', 'MP19', 'MP20', 'MP21'))
    ) as has_ambiguous_payment
  from public.supplier_invoices invoice
  left join public.expenses expense on expense.id = invoice.expense_id
)
select 'Fattura senza movimento spesa collegato' as anomaly, id, invoice_number, supplier_name
from invoice_checks
where expense_id is null
union all
select 'Totale fattura diverso dal movimento spesa', id, invoice_number, supplier_name
from invoice_checks
where expense_id is not null
  and linked_expense_cents <> case when document_type in ('TD04', 'TD08') then -total_cents else total_cents end
union all
select 'Pagamento automatico con metodo mancante o dubbio', id, invoice_number, supplier_name
from invoice_checks
where payment_status = 'automatic'
  and (not has_payment_details or has_ambiguous_payment)
union all
select 'RIBA/SEPA certa ancora classificata non pagata', id, invoice_number, supplier_name
from invoice_checks
where payment_status = 'unpaid'
  and has_payment_details
  and not has_ambiguous_payment
order by anomaly, supplier_name, invoice_number;
