-- Esegui una sola volta dopo employees-setup.sql e google-drive-archive-migration.sql.
-- Collega ogni anagrafica alla relativa sottocartella dell'Archivio generale.

alter table public.employees
  add column if not exists drive_folder_id text;

create unique index if not exists employees_drive_folder_id_unique
  on public.employees (drive_folder_id)
  where drive_folder_id is not null;

comment on column public.employees.drive_folder_id is
  'ID della cartella Google Drive riservata ai documenti del dipendente.';
