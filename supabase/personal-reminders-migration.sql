-- Esegui una sola volta dopo workforce-notifications-migration.sql
-- e notification-email-preferences-migration.sql.

alter table public.admin_notifications
  add column if not exists remind_on date,
  add column if not exists reminder_days integer
    check (reminder_days is null or reminder_days between 0 and 365),
  add column if not exists email_reminder boolean not null default true,
  add column if not exists reminder_sent_at timestamptz;

create index if not exists admin_notifications_personal_reminder_idx
  on public.admin_notifications (created_by, remind_on)
  where kind = 'note' and reminder_sent_at is null;

drop policy if exists "Admins manage notifications" on public.admin_notifications;

create policy "Admins read notifications and own notes"
on public.admin_notifications
for select
to authenticated
using (
  (select private.is_admin())
  and (kind <> 'note' or created_by = (select auth.uid()))
);

create policy "Admins create own notes"
on public.admin_notifications
for insert
to authenticated
with check (
  (select private.is_admin())
  and (kind <> 'note' or created_by = (select auth.uid()))
);

create policy "Admins update notifications and own notes"
on public.admin_notifications
for update
to authenticated
using (
  (select private.is_admin())
  and (kind <> 'note' or created_by = (select auth.uid()))
)
with check (
  (select private.is_admin())
  and (kind <> 'note' or created_by = (select auth.uid()))
);

create policy "Admins delete own notes"
on public.admin_notifications
for delete
to authenticated
using (
  (select private.is_admin())
  and kind = 'note'
  and created_by = (select auth.uid())
);

comment on column public.admin_notifications.remind_on is
  'Data in cui rendere attivo il promemoria personale.';
comment on column public.admin_notifications.reminder_days is
  'Numero di giorni di anticipo rispetto alla scadenza.';
