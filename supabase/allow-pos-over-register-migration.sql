-- Esegui una sola volta nel SQL Editor di Supabase.
-- Consente di registrare un importo POS superiore alla chiusura del registratore,
-- conservando separatamente il totale della chiusura e mantenendo i contanti a zero.

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

    update public.daily_revenues
    set register_total_cents = cash_cents + pos_cents;
  end if;
end
$$;

update public.daily_revenues
set cash_cents = 0
where cash_cents < 0;

alter table public.daily_revenues
  drop constraint if exists daily_revenues_cash_cents_check;

alter table public.daily_revenues
  add constraint daily_revenues_cash_cents_check check (cash_cents >= 0);

comment on column public.daily_revenues.register_total_cents is
  'Importo totale della chiusura del registratore.';

comment on column public.daily_revenues.cash_cents is
  'Quota contanti calcolata come massimo tra chiusura meno POS e zero.';
