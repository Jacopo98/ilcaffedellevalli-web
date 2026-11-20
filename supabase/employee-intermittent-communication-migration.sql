-- Esegui una sola volta dopo employees-setup.sql.
-- Codice della comunicazione UNILAV richiesto nel modello UNI Intermittenti.

alter table public.employees
  add column if not exists intermittent_communication_code text
  check (
    intermittent_communication_code is null
    or char_length(intermittent_communication_code) between 1 and 40
  );

comment on column public.employees.intermittent_communication_code is
  'Codice comunicazione UNILAV usato per le comunicazioni del lavoro intermittente.';
