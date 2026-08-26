-- Esegui una sola volta dopo workforce-notifications-migration.sql.

alter table public.profiles
  add column if not exists receive_email_notifications boolean not null default false;

grant update (receive_email_notifications) on public.profiles to authenticated;

drop policy if exists "Admins can update their email preference" on public.profiles;
create policy "Admins can update their email preference"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id and (select private.is_admin()))
with check ((select auth.uid()) = id and role = 'admin');

comment on column public.profiles.receive_email_notifications is
  'Consenso dell amministratore alla ricezione dei promemoria email sulle scadenze.';
