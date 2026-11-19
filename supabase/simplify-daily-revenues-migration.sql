-- Esegui una sola volta dopo allow-pos-over-register-migration.sql.
-- Mantiene negli incassi soltanto l'importo della chiusura registratore e il POS.
-- I conteggi di brioches/coperti e le note restano invariati.

alter table public.daily_revenues
  drop column if exists cash_cents,
  drop column if exists other_cents,
  drop column if exists refunds_cents,
  drop column if exists receipt_count,
  drop column if exists issued_invoices_cents,
  drop column if exists cash_expenses;

comment on column public.daily_revenues.register_total_cents is
  'Importo totale della chiusura del registratore, usato come entrata giornaliera.';

comment on column public.daily_revenues.pos_cents is
  'Quota POS della chiusura, conservata come informazione di dettaglio.';

comment on column public.daily_revenues.brioches_count is
  'Numero di brioches registrato nella giornata, conservato nello storico.';

comment on column public.daily_revenues.lunch_covers_count is
  'Numero di coperti a pranzo registrato nella giornata, conservato nello storico.';

-- Verifica finale: tutti e quattro i campi da conservare devono risultare presenti.
select
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'daily_revenues'
      and column_name = 'register_total_cents'
  ) as chiusura_registratore_presente,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'daily_revenues'
      and column_name = 'pos_cents'
  ) as pos_presente,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'daily_revenues'
      and column_name = 'brioches_count'
  ) as storico_brioches_presente,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'daily_revenues'
      and column_name = 'lunch_covers_count'
  ) as storico_coperti_presente;

