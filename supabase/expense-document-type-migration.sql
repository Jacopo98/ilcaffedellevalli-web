-- Esegui una sola volta dopo expenses-setup.sql.
-- Distingue le fatture (conteggiate per imponibile) dai costi semplici (conteggiati per intero).

alter table public.expenses
  add column if not exists is_invoice boolean not null default false;

comment on column public.expenses.is_invoice is
  'TRUE: nei riepiloghi conta l imponibile; FALSE: il totale inserito costituisce interamente il costo.';
