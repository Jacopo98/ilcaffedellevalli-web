import "server-only";

import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type MenuItem = {
  id: number;
  name: string;
  description: string | null;
  priceCents: number | null;
  allergens: string[];
  isVegetarian: boolean;
};

export type MenuCategory = {
  id: number;
  name: string;
  slug: string;
  items: MenuItem[];
};

type MenuItemRow = {
  id: number;
  name: string;
  description: string | null;
  price_cents: number | null;
  allergens: string[] | null;
  is_vegetarian: boolean;
  position: number;
};

type MenuCategoryRow = {
  id: number;
  name: string;
  slug: string;
  position: number;
  menu_items: MenuItemRow[] | null;
};

const fallbackMenu: MenuCategory[] = [
  {
    id: -1,
    name: "Caffetteria",
    slug: "caffetteria",
    items: [
      { id: -1, name: "Espresso delle Valli", description: "Miscela 100% arabica, note di cacao e frutta secca", priceCents: 130, allergens: [], isVegetarian: false },
      { id: -2, name: "Cappuccino", description: "Espresso, latte fresco e crema vellutata", priceCents: 180, allergens: ["latte"], isVegetarian: true },
    ],
  },
  {
    id: -2,
    name: "Brioches",
    slug: "brioches",
    items: [
      { id: -3, name: "Croissant artigianale", description: "Vuoto, crema, albicocca o cioccolato", priceCents: 180, allergens: ["glutine"], isVegetarian: true },
    ],
  },
  {
    id: -3,
    name: "Pranzo",
    slug: "pranzo",
    items: [
      { id: -4, name: "Piatto del giorno", description: "Una proposta semplice e gustosa per la pausa pranzo", priceCents: 1000, allergens: [], isVegetarian: false },
    ],
  },
  {
    id: -4,
    name: "Aperitivo",
    slug: "aperitivo",
    items: [
      { id: -5, name: "Spritz delle Valli", description: "Bitter all’arancia, bollicine e soda", priceCents: 700, allergens: [], isVegetarian: true },
    ],
  },
];

async function queryMenu(): Promise<MenuCategory[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("menu_categories")
    .select("id, name, slug, position, menu_items(id, name, description, price_cents, allergens, is_vegetarian, position)")
    .eq("is_active", true)
    .eq("menu_items.is_available", true)
    .order("position", { ascending: true })
    .order("position", { referencedTable: "menu_items", ascending: true });

  if (error) throw new Error(`Errore caricamento menu: ${error.message}`);

  return ((data ?? []) as MenuCategoryRow[]).map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    items: (category.menu_items ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      priceCents: item.price_cents,
      allergens: item.allergens ?? [],
      isVegetarian: item.is_vegetarian,
    })),
  }));
}

const getCachedMenu = unstable_cache(queryMenu, ["public-menu-v2"], {
  revalidate: 60,
  tags: ["menu"],
});

export async function getPublicMenu(): Promise<MenuCategory[]> {
  try {
    const menu = await getCachedMenu();
    return menu.length > 0 ? menu : fallbackMenu;
  } catch (error) {
    console.error("Supabase non raggiungibile, uso il menu statico.", error);
    return fallbackMenu;
  }
}
