import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { AdminSubmitButton } from "@/components/admin-submit-button";
import { requireAdmin } from "@/lib/auth";
import { createCategory, createItem, deleteCategory, deleteItem, updateCategory, updateItem } from "./actions";

type AdminItem = { id: number; category_id: number; name: string; description: string | null; price_cents: number; allergens: string[]; is_vegetarian: boolean; is_available: boolean; position: number };
type AdminCategory = { id: number; name: string; slug: string; description: string | null; position: number; is_active: boolean; menu_items: AdminItem[] };

export default async function AdminMenuPage() {
  let context;
  try { context = await requireAdmin(); } catch { redirect("/admin"); }

  const { data, error } = await context.supabase
    .from("menu_categories")
    .select("id, name, slug, description, position, is_active, menu_items(id, category_id, name, description, price_cents, allergens, is_vegetarian, is_available, position)")
    .order("position", { ascending: true })
    .order("position", { referencedTable: "menu_items", ascending: true });

  if (error) throw new Error("Impossibile caricare il menu amministrativo.");
  const categories = (data ?? []) as AdminCategory[];

  return (
    <main className="admin-container py-10 sm:py-14">
      <Link className="admin-inline-link" href="/admin"><ArrowLeft size={15} /> Dashboard</Link>
      <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="section-number">Amministrazione</p><h1 className="mt-3 font-display text-4xl sm:text-6xl">Gestione menu</h1></div>
        <p className="max-w-sm text-sm text-ink/50">Le modifiche diventano visibili sul sito entro un minuto.</p>
      </div>

      <details className="admin-panel mt-10">
        <summary><Plus size={18} /> Nuova categoria</summary>
        <form action={createCategory} className="admin-edit-grid mt-6">
          <label className="admin-field"><span>Nome</span><input name="name" required maxLength={60} /></label>
          <label className="admin-field"><span>Ordine</span><input name="position" type="number" min="0" defaultValue={categories.length + 1} required /></label>
          <label className="admin-field admin-field-wide"><span>Descrizione</span><input name="description" maxLength={300} /></label>
          <div className="admin-field-wide"><AdminSubmitButton>Crea categoria</AdminSubmitButton></div>
        </form>
      </details>

      <div className="mt-6 space-y-6">
        {categories.map((category) => (
          <section className="admin-panel" key={category.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-[.15em] text-orange">Categoria {category.position}</p><h2 className="mt-1 font-display text-3xl">{category.name}</h2></div>
              <span className={`admin-status ${category.is_active ? "admin-status-active" : ""}`}>{category.is_active ? "Visibile" : "Nascosta"}</span>
            </div>

            <form action={updateCategory} className="admin-edit-grid mt-7 border-t border-ink/10 pt-6">
              <input name="id" type="hidden" value={category.id} />
              <label className="admin-field"><span>Nome</span><input name="name" defaultValue={category.name} required maxLength={60} /></label>
              <label className="admin-field"><span>Ordine</span><input name="position" type="number" min="0" defaultValue={category.position} required /></label>
              <label className="admin-field admin-field-wide"><span>Descrizione</span><input name="description" defaultValue={category.description ?? ""} maxLength={300} /></label>
              <label className="admin-check"><input name="is_active" type="checkbox" defaultChecked={category.is_active} /> Categoria visibile</label>
              <div className="flex flex-wrap gap-2 sm:justify-end"><AdminSubmitButton variant="secondary">Salva categoria</AdminSubmitButton></div>
            </form>

            <div className="mt-8 space-y-4">
              {category.menu_items.map((item) => (
                <details className="admin-item" key={item.id}>
                  <summary><strong>{item.name}</strong><span className="admin-item-meta"><small>{(item.price_cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</small><span className={item.is_available ? "text-ink/45" : "text-orange"}>{item.is_available ? "Disponibile" : "Nascosto"}</span></span></summary>
                  <form action={updateItem} className="admin-edit-grid mt-6">
                    <input name="id" type="hidden" value={item.id} />
                    <label className="admin-field"><span>Nome</span><input name="name" defaultValue={item.name} required maxLength={100} /></label>
                    <label className="admin-field"><span>Prezzo (€)</span><input name="price" type="number" min="0" step="0.01" defaultValue={(item.price_cents / 100).toFixed(2)} required /></label>
                    <label className="admin-field"><span>Categoria</span><select name="category_id" defaultValue={item.category_id}>{categories.map((option) => <option value={option.id} key={option.id}>{option.name}</option>)}</select></label>
                    <label className="admin-field"><span>Ordine</span><input name="position" type="number" min="0" defaultValue={item.position} required /></label>
                    <label className="admin-field admin-field-wide"><span>Descrizione</span><textarea name="description" defaultValue={item.description ?? ""} maxLength={500} rows={2} /></label>
                    <label className="admin-field admin-field-wide"><span>Allergeni separati da virgola</span><input name="allergens" defaultValue={item.allergens.join(", ")} maxLength={300} /></label>
                    <div className="flex flex-wrap gap-5"><label className="admin-check"><input name="is_available" type="checkbox" defaultChecked={item.is_available} /> Disponibile</label><label className="admin-check"><input name="is_vegetarian" type="checkbox" defaultChecked={item.is_vegetarian} /> Vegetariano</label></div>
                    <div className="flex flex-wrap gap-2 sm:justify-end"><AdminSubmitButton variant="secondary">Salva prodotto</AdminSubmitButton></div>
                  </form>
                  <form action={deleteItem} className="mt-4 border-t border-ink/10 pt-4"><input name="id" type="hidden" value={item.id} /><AdminSubmitButton variant="danger" confirmMessage={`Eliminare definitivamente “${item.name}”?`}>Elimina prodotto</AdminSubmitButton></form>
                </details>
              ))}
            </div>

            <details className="admin-item mt-4">
              <summary><span className="flex items-center gap-2"><Plus size={16} /> Aggiungi prodotto</span></summary>
              <form action={createItem} className="admin-edit-grid mt-6">
                <input name="category_id" type="hidden" value={category.id} />
                <label className="admin-field"><span>Nome</span><input name="name" required maxLength={100} /></label>
                <label className="admin-field"><span>Prezzo (€)</span><input name="price" type="number" min="0" step="0.01" required /></label>
                <label className="admin-field"><span>Ordine</span><input name="position" type="number" min="0" defaultValue={category.menu_items.length + 1} required /></label>
                <label className="admin-field admin-field-wide"><span>Descrizione</span><textarea name="description" maxLength={500} rows={2} /></label>
                <label className="admin-field admin-field-wide"><span>Allergeni separati da virgola</span><input name="allergens" maxLength={300} /></label>
                <div className="flex flex-wrap gap-5"><label className="admin-check"><input name="is_available" type="checkbox" defaultChecked /> Disponibile</label><label className="admin-check"><input name="is_vegetarian" type="checkbox" /> Vegetariano</label></div>
                <div className="sm:text-right"><AdminSubmitButton>Crea prodotto</AdminSubmitButton></div>
              </form>
            </details>

            <form action={deleteCategory} className="mt-8 border-t border-ink/10 pt-5"><input name="id" type="hidden" value={category.id} /><AdminSubmitButton variant="danger" confirmMessage={`Eliminare “${category.name}” e tutti i suoi prodotti?`}>Elimina categoria</AdminSubmitButton></form>
          </section>
        ))}
      </div>
    </main>
  );
}
