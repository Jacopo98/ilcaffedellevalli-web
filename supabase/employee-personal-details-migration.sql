-- Esegui una sola volta dopo employees-setup.sql.
-- Aggiunge dati anagrafici e amministrativi senza modificare i dipendenti esistenti.

alter table public.employees
  add column if not exists tax_code text,
  add column if not exists iban text,
  add column if not exists birth_date date,
  add column if not exists residence_address text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text;

alter table public.employees
  drop constraint if exists employees_tax_code_check,
  drop constraint if exists employees_iban_check,
  drop constraint if exists employees_residence_address_check,
  drop constraint if exists employees_emergency_contact_name_check,
  drop constraint if exists employees_emergency_contact_phone_check;

alter table public.employees
  add constraint employees_tax_code_check
    check (tax_code is null or tax_code ~ '^[A-Z0-9]{16}$'),
  add constraint employees_iban_check
    check (iban is null or iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$'),
  add constraint employees_residence_address_check
    check (residence_address is null or char_length(residence_address) <= 300),
  add constraint employees_emergency_contact_name_check
    check (emergency_contact_name is null or char_length(emergency_contact_name) <= 120),
  add constraint employees_emergency_contact_phone_check
    check (emergency_contact_phone is null or char_length(emergency_contact_phone) <= 30);

create unique index if not exists employees_tax_code_unique
  on public.employees (tax_code)
  where tax_code is not null;

comment on column public.employees.tax_code is 'Codice fiscale normalizzato in maiuscolo.';
comment on column public.employees.iban is 'IBAN del dipendente normalizzato senza spazi.';
comment on column public.employees.birth_date is 'Data di nascita del dipendente.';
comment on column public.employees.residence_address is 'Indirizzo di residenza completo.';
comment on column public.employees.emergency_contact_name is 'Referente da contattare in caso di emergenza.';
comment on column public.employees.emergency_contact_phone is 'Telefono del referente di emergenza.';
