-- Esegui una sola volta nel SQL Editor di Supabase.
-- Conserva separatamente il totale della chiusura e il dettaglio POS.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'daily_revenues'
      and column_name = 'register_total_cents'
  ) then
    alter table public.daily_revenues
      add column register_total_cents integer not null default 0
      check (register_total_cents >= 0);

  end if;
end
$$;

comment on column public.daily_revenues.register_total_cents is
  'Importo totale della chiusura del registratore.';

