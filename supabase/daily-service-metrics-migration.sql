-- Esegui una sola volta nel SQL Editor di Supabase, dopo finance-management-migration.sql.
-- NULL significa che il conteggio non è stato ancora registrato; 0 è un valore inserito esplicitamente.

alter table public.daily_revenues
  add column if not exists brioches_count integer
    check (brioches_count is null or brioches_count between 0 and 100000),
  add column if not exists lunch_covers_count integer
    check (lunch_covers_count is null or lunch_covers_count between 0 and 100000);

comment on column public.daily_revenues.brioches_count is 'Numero di brioches della giornata, non usato nei conteggi economici.';
comment on column public.daily_revenues.lunch_covers_count is 'Numero di coperti a pranzo della giornata, non usato nei conteggi economici.';
