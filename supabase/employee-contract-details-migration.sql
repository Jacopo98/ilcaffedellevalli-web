-- Esegui una sola volta dopo employees-setup.sql.
-- Aggiunge i dati contrattuali usati per calcolare il costo mensile RAL / 12.

alter table public.employees
  add column if not exists contract_level text,
  add column if not exists ral_cents integer,
  add column if not exists contract_start date,
  add column if not exists contract_end date;

alter table public.employees drop constraint if exists employees_contract_level_check;
alter table public.employees add constraint employees_contract_level_check
  check (contract_level is null or char_length(contract_level) <= 80);

alter table public.employees drop constraint if exists employees_ral_cents_check;
alter table public.employees add constraint employees_ral_cents_check
  check (ral_cents is null or ral_cents >= 0);

alter table public.employees drop constraint if exists employees_contract_dates_check;
alter table public.employees add constraint employees_contract_dates_check
  check (contract_end is null or contract_start is null or contract_end >= contract_start);

update public.employees
set contract_start = hire_date
where contract_start is null and hire_date is not null;

comment on column public.employees.ral_cents is 'Retribuzione annua lorda in centesimi; competenza mensile calcolata come RAL / 12.';
comment on column public.employees.contract_end is 'NULL indica un contratto senza data di fine stabilita.';
