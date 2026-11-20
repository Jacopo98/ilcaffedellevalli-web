-- Esegui una sola volta dopo employee-intermittent-communication-migration.sql.
-- Conserva i destinatari amministrativi delle comunicazioni UNI Intermittenti.

create table if not exists public.intermittent_email_settings (
  id smallint primary key default 1 check (id = 1),
  recipients text[] not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid()
);

alter table public.intermittent_email_settings enable row level security;
grant select, insert, update on public.intermittent_email_settings to authenticated;

drop policy if exists "Admins manage intermittent email settings" on public.intermittent_email_settings;
create policy "Admins manage intermittent email settings"
on public.intermittent_email_settings for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

insert into public.intermittent_email_settings (id, recipients)
values (1, '{}')
on conflict (id) do nothing;
