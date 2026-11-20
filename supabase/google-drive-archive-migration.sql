-- Esegui una sola volta nel SQL Editor di Supabase.
-- I token OAuth sono cifrati dall'app prima del salvataggio e non sono accessibili ai client.

create table if not exists public.google_drive_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_email text not null,
  encrypted_access_token text not null,
  encrypted_refresh_token text,
  token_expiry timestamptz,
  granted_scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_drive_connections enable row level security;

revoke all on public.google_drive_connections from anon, authenticated;

drop trigger if exists google_drive_connections_set_updated_at on public.google_drive_connections;
create trigger google_drive_connections_set_updated_at
before update on public.google_drive_connections
for each row execute procedure public.set_updated_at();

comment on table public.google_drive_connections is
  'Connessioni OAuth Google Drive cifrate e utilizzabili esclusivamente dal backend.';
