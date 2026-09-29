-- Esegui una sola volta dopo personal-reminders-migration.sql.
-- L'archiviazione è reversibile e non elimina alcuna notifica.

alter table public.admin_notifications
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null;

create index if not exists admin_notifications_archive_due_idx
  on public.admin_notifications (archived_at, due_date, created_at desc);

comment on column public.admin_notifications.archived_at is
  'Data di chiusura/archiviazione della notifica; NULL indica una notifica attiva.';

