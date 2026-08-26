-- Sostituisce il catalogo, ma conserva prodotti e contenuti della categoria Pranzo.
-- I prezzi ancora da definire sono NULL e sul sito vengono mostrati con "—".

begin;

alter table public.menu_items alter column price_cents drop not null;

delete from public.menu_items
where category_id in (select id from public.menu_categories where slug <> 'pranzo');

delete from public.menu_categories where slug <> 'pranzo';

insert into public.menu_categories (name, slug, description, position, is_active)
values
  ('Caffetteria', 'caffetteria', 'Espressi, preparazioni con latte, ginseng e orzo.', 1, true),
  ('Brioches e dolci', 'brioches-e-dolci', 'Proposte dolci e salate per la colazione.', 2, true),
  ('Bibite e analcolici', 'bibite-e-analcolici', 'Succhi, bibite, acqua e proposte analcoliche.', 4, true),
  ('Birre', 'birre', 'Birre in bottiglia e alla spina.', 5, true),
  ('Vini e distillati', 'vini-e-distillati', 'Bollicine, vini, amari e distillati.', 6, true),
  ('Aperitivi e cocktail', 'aperitivi-e-cocktail', 'I classici dell’aperitivo.', 7, true),
  ('Varie', 'varie', null, 8, true);

-- Se Pranzo esiste, ne mantiene descrizione e prodotti e ne aggiorna soltanto la posizione.
-- Se era già stato eliminato, ricrea la categoria e aggiunge un esempio minimo.
insert into public.menu_categories (name, slug, description, position, is_active)
values ('Pranzo', 'pranzo', 'Proposte semplici per la pausa pranzo.', 3, true)
on conflict (slug) do update
set position = excluded.position,
    is_active = true;

insert into public.menu_items
  (category_id, name, description, price_cents, allergens, is_vegetarian, is_available, position)
select id, 'Piatto del giorno', 'Una proposta semplice e gustosa per la pausa pranzo.', 1000,
       array[]::text[], false, true, 1
from public.menu_categories
where slug = 'pranzo'
  and not exists (
    select 1 from public.menu_items
    where category_id = public.menu_categories.id
  );

with products (category_slug, name, description, price_cents, position) as (
  values
    ('caffetteria', 'Caffè doppio', null, 250, 1),
    ('caffetteria', 'Corretto', 'Espresso con aggiunta di liquore.', 170, 2),
    ('caffetteria', 'Cappuccino', null, 170, 3),
    ('caffetteria', 'Caffè americano', null, 180, 4),
    ('caffetteria', 'Caffè', null, 130, 5),
    ('caffetteria', 'Macchiato', null, 130, 6),
    ('caffetteria', 'Macchiatone', null, 150, 7),
    ('caffetteria', 'Cappuccino doppio', null, 200, 8),
    ('caffetteria', 'Cappuccino doppio caffè', 'Cappuccino preparato con doppio espresso.', 300, 9),
    ('caffetteria', 'Latte macchiato', null, 180, 10),
    ('caffetteria', 'Latte bianco', null, 170, 11),
    ('caffetteria', 'Latte macchiato avena/soia', 'Preparato con bevanda vegetale a scelta.', 200, 12),
    ('caffetteria', 'Marocchino', null, 160, 13),
    ('caffetteria', 'Americano', null, 180, 14),
    ('caffetteria', 'Schiumetta', null, 100, 15),
    ('caffetteria', 'Schiumetta tazza grande', null, 150, 16),
    ('caffetteria', 'Ginseng piccolo', null, 150, 17),
    ('caffetteria', 'Ginseng grande', null, 200, 18),
    ('caffetteria', 'Orzo piccolo', null, 150, 19),
    ('caffetteria', 'Orzo grande', null, 200, 20),
    ('caffetteria', 'Cappuccino orzo/ginseng', 'Disponibile nella variante orzo o ginseng.', 200, 21),

    ('brioches-e-dolci', 'Brioches', null, 150, 1),
    ('brioches-e-dolci', 'Brioches extra', null, 170, 2),
    ('brioches-e-dolci', 'Mignon', 'Disponibile nelle proposte da € 1,20 e € 1,80.', 120, 3),
    ('brioches-e-dolci', 'Frolle', null, 250, 4),
    ('brioches-e-dolci', 'Crostatine', null, 250, 5),
    ('brioches-e-dolci', 'Brioches salata', null, 350, 6),

    ('bibite-e-analcolici', 'Succhi', 'Gusti disponibili al banco.', 250, 1),
    ('bibite-e-analcolici', 'Spremuta', 'Preparata al momento.', 350, 2),
    ('bibite-e-analcolici', 'Centrifuga', 'Preparata al momento.', 400, 3),
    ('bibite-e-analcolici', 'Lattina', null, 300, 4),
    ('bibite-e-analcolici', 'ACE', null, null, 5),
    ('bibite-e-analcolici', 'Pesca', null, null, 6),
    ('bibite-e-analcolici', 'Albicocca', null, null, 7),
    ('bibite-e-analcolici', 'Ananas', null, null, 8),
    ('bibite-e-analcolici', 'Mirtillo', null, null, 9),
    ('bibite-e-analcolici', 'Pera', null, null, 10),
    ('bibite-e-analcolici', 'Tè pesca / limone', null, null, 11),
    ('bibite-e-analcolici', 'Sprite', null, null, 12),
    ('bibite-e-analcolici', 'Lemon Soda', null, null, 13),
    ('bibite-e-analcolici', 'Red Bull', null, null, 14),
    ('bibite-e-analcolici', 'Coca-Cola', null, null, 15),
    ('bibite-e-analcolici', 'Coca-Cola Zero', null, null, 16),
    ('bibite-e-analcolici', 'Chinotto', null, null, 17),
    ('bibite-e-analcolici', 'Schweppes', null, null, 18),
    ('bibite-e-analcolici', 'Aranciata', null, null, 19),
    ('bibite-e-analcolici', 'Acqua naturale', null, null, 20),
    ('bibite-e-analcolici', 'Acqua frizzante', null, null, 21),

    ('birre', 'Beck’s', null, null, 1),
    ('birre', 'Corona', null, null, 2),
    ('birre', 'Ichnusa', null, null, 3),
    ('birre', 'Ichnusa non filtrata', null, null, 4),
    ('birre', 'Bud', null, null, 5),
    ('birre', 'Bionda alla spina', null, null, 6),

    ('vini-e-distillati', 'Prosecco', 'Due etichette disponibili.', null, 1),
    ('vini-e-distillati', 'Ribolla Gialla', 'Vino bianco.', null, 2),
    ('vini-e-distillati', 'Sauvignon', 'Vino bianco.', null, 3),
    ('vini-e-distillati', 'Pinot Grigio', 'Vino bianco.', null, 4),
    ('vini-e-distillati', 'Lugana', 'Vino bianco.', null, 5),
    ('vini-e-distillati', 'Cabernet', 'Vino rosso.', null, 6),
    ('vini-e-distillati', 'Merlot', 'Vino rosso.', null, 7),
    ('vini-e-distillati', 'Pinot Nero', 'Vino rosso.', null, 8),
    ('vini-e-distillati', 'Nardini', 'Grappa.', null, 9),
    ('vini-e-distillati', 'Baileys', 'Crema di whiskey.', null, 10),
    ('vini-e-distillati', 'Vecchia Romagna', null, null, 11),
    ('vini-e-distillati', 'Santero', null, null, 12),
    ('vini-e-distillati', 'Montenegro', null, null, 13),
    ('vini-e-distillati', 'Amaro del Capo', null, null, 14),
    ('vini-e-distillati', 'Jägermeister', null, null, 15),
    ('vini-e-distillati', 'Grappa barricata', null, null, 16),
    ('vini-e-distillati', 'Aperol', null, null, 17),
    ('vini-e-distillati', 'Campari', null, null, 18),
    ('vini-e-distillati', 'Martini Rosso', null, null, 19),
    ('vini-e-distillati', 'Martini Bianco', null, null, 20),
    ('vini-e-distillati', 'Gin', null, null, 21),
    ('vini-e-distillati', 'Vodka', null, null, 22),
    ('vini-e-distillati', 'Tequila', null, null, 23),

    ('aperitivi-e-cocktail', 'Spritz', null, null, 1),
    ('aperitivi-e-cocktail', 'Aperol Soda', null, null, 2),
    ('aperitivi-e-cocktail', 'Crodino', null, null, 3),

    ('varie', 'Caramelle', null, null, 1)
)
insert into public.menu_items
  (category_id, name, description, price_cents, allergens, is_vegetarian, is_available, position)
select
  categories.id,
  products.name,
  products.description,
  products.price_cents,
  array[]::text[],
  false,
  true,
  products.position
from products
join public.menu_categories as categories on categories.slug = products.category_slug;

-- Simboli mostrati dal sito: spiga = glutine, foglia = proposta vegetariana.
-- Verificare sempre questi dati sulle ricette e sulle etichette effettivamente utilizzate.
update public.menu_items
set allergens = array['glutine'],
    is_vegetarian = true
where category_id = (select id from public.menu_categories where slug = 'brioches-e-dolci')
  and name <> 'Brioches salata';

update public.menu_items
set is_vegetarian = true
where category_id = (select id from public.menu_categories where slug = 'caffetteria')
  and name in (
    'Cappuccino', 'Macchiato', 'Macchiatone', 'Cappuccino doppio',
    'Cappuccino doppio caffè', 'Latte macchiato', 'Latte bianco',
    'Latte macchiato avena/soia', 'Marocchino', 'Schiumetta',
    'Schiumetta tazza grande', 'Cappuccino orzo/ginseng'
  );

commit;
