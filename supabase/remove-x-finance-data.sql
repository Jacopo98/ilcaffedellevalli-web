-- Rimozione definitiva della classificazione F/X.
-- Elimina:
--   1. le spese con accounting_label = 'X';
--   2. i piani di costo fisso con accounting_label = 'X' e le loro competenze.
--   3. le colonne accounting_label ormai inutilizzate;
--   4. l'eventuale schema temporaneo di backup creato in precedenza.
-- I record precedentemente F, le entrate, le fatture, i versamenti e gli altri
-- dati rimangono invariati.

begin;

-- I trigger impediscono modifiche ai mesi chiusi. Vengono sospesi soltanto
-- dentro questa transazione e riattivati prima del commit.
alter table public.expenses disable trigger protect_closed_expense;
alter table public.cost_plan_months disable trigger protect_closed_cost_month;

delete from public.expenses
where accounting_label = 'X';

delete from public.recurring_cost_plans
where accounting_label = 'X';

-- Dopo la cancellazione non rimane più alcuna distinzione F/X nel database.
alter table public.expenses
  drop column accounting_label;

alter table public.recurring_cost_plans
  drop column accounting_label;

-- Elimina eventuali copie temporanee create dal precedente script di backup.
drop schema if exists backup_finance_20261117 cascade;

alter table public.expenses enable trigger protect_closed_expense;
alter table public.cost_plan_months enable trigger protect_closed_cost_month;

commit;

-- Verifica finale: entrambe le colonne e lo schema di backup devono risultare assenti.
select
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'expenses'
      and column_name = 'accounting_label'
  ) as etichetta_spese_rimossa,
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'recurring_cost_plans'
      and column_name = 'accounting_label'
  ) as etichetta_costi_fissi_rimossa,
  to_regnamespace('backup_finance_20261117') is null as backup_database_rimosso;

