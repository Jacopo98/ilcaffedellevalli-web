import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { MenuManager, type AdminMenuCategory } from "./menu-manager";

export default async function AdminMenuPage() {
  let context;
  try { context = await requireAdmin(); } catch { redirect("/admin"); }
  const { data, error } = await context.supabase
    .from("menu_categories")
    .select("id, name, slug, description, position, is_active, menu_items(id, category_id, name, description, section, price_cents, allergens, is_vegetarian, is_available, position)")
    .order("position", { ascending: true })
    .order("position", { referencedTable: "menu_items", ascending: true });
  if (error) throw new Error("Impossibile caricare il menu amministrativo.");
  return <MenuManager categories={(data ?? []) as AdminMenuCategory[]} />;
}
