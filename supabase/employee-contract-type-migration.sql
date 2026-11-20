-- Esegui una sola volta dopo employees-setup.sql.
-- I dipendenti già presenti mantengono il comportamento precedente e vengono
-- inizializzati come dipendenti a tempo indeterminato.

alter table public.employees
  add column if not exists contract_type text not null default 'indefinite';

alter table public.employees
  drop constraint if exists employees_contract_type_check;

alter table public.employees
  add constraint employees_contract_type_check
  check (contract_type in ('indefinite', 'fixed_term', 'on_call'));

comment on column public.employees.contract_type is
  'Tipologia contrattuale: indefinite, fixed_term oppure on_call.';
