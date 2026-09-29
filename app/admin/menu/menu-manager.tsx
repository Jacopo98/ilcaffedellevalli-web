"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { ArrowLeft, Check, MoreHorizontal, Plus, Save, X } from "lucide-react";
import { createCategory, createItem, deleteCategory, deleteItem, updateCategory, updateItem } from "./actions";
import "./menu-manager.css";

export type AdminMenuItem = { id: number; category_id: number; name: string; description: string | null; section: string | null; price_cents: number | null; allergens: string[]; is_vegetarian: boolean; is_available: boolean; position: number };
export type AdminMenuCategory = { id: number; name: string; slug: string; description: string | null; position: number; is_active: boolean; menu_items: AdminMenuItem[] };
type Editor = { mode: "item"; item: AdminMenuItem } | { mode: "new-item"; categoryId: number } | { mode: "new-category" } | null;

export function MenuManager({ categories }: { categories: AdminMenuCategory[] }) {
  const [editor, setEditor] = useState<Editor>(null);
  const productCount = categories.reduce((total, category) => total + category.menu_items.length, 0);

  return <main className="admin-container menu-admin-page">
    <div className="menu-admin-topbar"><Link className="admin-inline-link" href="/admin"><ArrowLeft size={15}/> Dashboard</Link><button className="admin-action admin-action-primary admin-action-create" onClick={() => setEditor({ mode: "new-category" })}><Plus size={15}/> Nuova categoria</button></div>
    <header className="menu-admin-heading"><div><p className="section-number">Amministrazione</p><h1>Gestione menu</h1><p>Modifica rapidamente i campi principali oppure apri i dettagli completi del prodotto.</p></div><div className="menu-admin-stats"><span><strong>{categories.length}</strong> categorie</span><span><strong>{productCount}</strong> prodotti</span></div></header>
    <div className="menu-category-list">
      {categories.map((category) => <section className="menu-category-panel" key={category.id}>
        <form action={updateCategory} className="menu-category-header">
          <input type="hidden" name="id" value={category.id}/><input type="hidden" name="description" value={category.description ?? ""}/><span className="menu-category-index">{String(category.position).padStart(2, "0")}</span>
          <label><span>Categoria</span><input name="name" defaultValue={category.name} required maxLength={60}/></label><label className="menu-category-order"><span>Ordine</span><input name="position" type="number" min="0" defaultValue={category.position} required/></label>
          <label className="menu-inline-check"><input name="is_active" type="checkbox" defaultChecked={category.is_active}/><i/><span>Visibile</span></label><RowSaveButton label="Salva categoria"/>
        </form>
        <div className="menu-admin-table-head"><span>Ord.</span><span>Prodotto</span><span>Sottocategoria</span><span>Prezzo</span><span>Visibile</span><span>Azioni</span></div>
        <div className="menu-admin-rows">
          {category.menu_items.map((item) => <form action={updateItem} className="menu-admin-row" key={item.id}>
            <input type="hidden" name="id" value={item.id}/><input type="hidden" name="category_id" value={item.category_id}/><input type="hidden" name="description" value={item.description ?? ""}/><input type="hidden" name="allergens" value={item.allergens.join(", ")}/>{item.is_vegetarian && <input type="hidden" name="is_vegetarian" value="on"/>}
            <label className="menu-row-position"><span>Ordine</span><input name="position" type="number" min="0" defaultValue={item.position} required/></label><label className="menu-row-name"><span>Prodotto</span><input name="name" defaultValue={item.name} required maxLength={100}/></label><label className="menu-row-section"><span>Sottocategoria</span><input name="section" defaultValue={item.section ?? ""} maxLength={80} placeholder="Nessuna"/></label>
            <label className="menu-row-price"><span>Prezzo</span><span className="menu-price-input"><b>€</b><input name="price" inputMode="decimal" defaultValue={item.price_cents === null ? "" : (item.price_cents / 100).toFixed(2)} placeholder="—"/></span></label>
            <label className="menu-row-availability"><input name="is_available" type="checkbox" defaultChecked={item.is_available}/><i><Check/></i><span>Disponibile</span></label>
            <div className="menu-row-actions"><button type="button" className="menu-detail-button" title="Altri dettagli" aria-label={`Altri dettagli di ${item.name}`} onClick={() => setEditor({ mode: "item", item })}><MoreHorizontal/></button><RowSaveButton label="Salva"/><RowDeleteButton item={item}/></div>
          </form>)}
          {!category.menu_items.length && <div className="menu-category-empty">Nessun prodotto in questa categoria.</div>}
        </div>
        <footer className="menu-category-footer"><button className="admin-action admin-action-primary admin-action-create" onClick={() => setEditor({ mode: "new-item", categoryId: category.id })}><Plus size={15}/> Aggiungi prodotto</button><DeleteButton action={deleteCategory} id={category.id} message={`Eliminare “${category.name}” e tutti i suoi prodotti?`} category/></footer>
      </section>)}
    </div>
    {editor?.mode === "item" && <ItemModal item={editor.item} categories={categories} onClose={() => setEditor(null)}/>} 
    {editor?.mode === "new-item" && <ItemModal categoryId={editor.categoryId} categories={categories} onClose={() => setEditor(null)}/>} 
    {editor?.mode === "new-category" && <CategoryModal position={categories.length + 1} onClose={() => setEditor(null)}/>} 
  </main>;
}

function RowSaveButton({ label }: { label: string }) { const { pending } = useFormStatus(); return <button className="menu-row-save" type="submit" disabled={pending} title={label}>{pending ? <span className="menu-button-spinner"/> : <Save/>}<span>{pending ? "Salvo…" : label}</span></button>; }
function RowDeleteButton({ item }: { item: AdminMenuItem }) { const [pending, startTransition] = useTransition(); return <button type="button" className="menu-row-delete" disabled={pending} title="Elimina prodotto" aria-label={`Elimina ${item.name}`} onClick={() => { if (!window.confirm(`Eliminare definitivamente “${item.name}”?`)) return; const data = new FormData(); data.set("id", String(item.id)); startTransition(() => deleteItem(data)); }}>{pending ? <span className="menu-button-spinner"/> : <X/>}</button>; }
function DeleteButton({ action, id, message, category = false }: { action: (data: FormData) => Promise<void>; id: number; message: string; category?: boolean }) { return <form action={action} className="menu-category-delete-form"><input type="hidden" name="id" value={id}/><button type="submit" className="menu-category-delete" title={category ? "Elimina categoria" : "Elimina"} aria-label={category ? "Elimina categoria" : "Elimina"} onClick={(event) => { if (!window.confirm(message)) event.preventDefault(); }}><X/></button></form>; }

function ItemModal({ item, categoryId, categories, onClose }: { item?: AdminMenuItem; categoryId?: number; categories: AdminMenuCategory[]; onClose: () => void }) {
  const category = categoryId ?? item?.category_id ?? categories[0]?.id;
  return <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="admin-modal admin-modal-wide"><button className="modal-close" onClick={onClose}><X/></button><p className="admin-kicker">Menu completo</p><h2>{item ? "Dettagli prodotto" : "Nuovo prodotto"}</h2><form action={item ? updateItem : createItem} className="admin-edit-grid">{item && <input type="hidden" name="id" value={item.id}/>}<label className="admin-field"><span>Nome</span><input name="name" defaultValue={item?.name ?? ""} required maxLength={100}/></label><label className="admin-field"><span>Prezzo (€)</span><input name="price" type="number" min="0" step=".01" defaultValue={item?.price_cents == null ? "" : (item.price_cents / 100).toFixed(2)} placeholder="Da definire"/></label><label className="admin-field"><span>Categoria</span><select name="category_id" defaultValue={category}>{categories.map((option) => <option value={option.id} key={option.id}>{option.name}</option>)}</select></label><label className="admin-field"><span>Ordine</span><input name="position" type="number" min="0" defaultValue={item?.position ?? (categories.find((entry) => entry.id === category)?.menu_items.length ?? 0) + 1} required/></label><label className="admin-field admin-field-wide"><span>Sottocategoria</span><input name="section" defaultValue={item?.section ?? ""} maxLength={80} placeholder="Es. Birre"/></label><label className="admin-field admin-field-wide"><span>Descrizione</span><textarea name="description" defaultValue={item?.description ?? ""} maxLength={500} rows={3}/></label><label className="admin-field admin-field-wide"><span>Allergeni separati da virgola</span><input name="allergens" defaultValue={item?.allergens.join(", ") ?? ""} maxLength={300}/></label><div className="menu-modal-checks admin-field-wide"><label className="admin-check"><input name="is_available" type="checkbox" defaultChecked={item?.is_available ?? true}/> Disponibile</label><label className="admin-check"><input name="is_vegetarian" type="checkbox" defaultChecked={item?.is_vegetarian ?? false}/> Vegetariano</label></div><div className="modal-actions admin-field-wide"><button type="button" className="admin-action admin-action-secondary" onClick={onClose}>Annulla</button><ModalSubmitButton label={item ? "Salva dettagli" : "Crea prodotto"}/></div></form></section></div>;
}
function CategoryModal({ position, onClose }: { position: number; onClose: () => void }) { return <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="admin-modal"><button className="modal-close" onClick={onClose}><X/></button><p className="admin-kicker">Organizzazione menu</p><h2>Nuova categoria</h2><form action={createCategory} className="admin-edit-grid"><label className="admin-field"><span>Nome</span><input name="name" required maxLength={60}/></label><label className="admin-field"><span>Ordine</span><input name="position" type="number" min="0" defaultValue={position} required/></label><label className="admin-field admin-field-wide"><span>Descrizione</span><textarea name="description" maxLength={300} rows={3}/></label><div className="modal-actions admin-field-wide"><button type="button" className="admin-action admin-action-secondary" onClick={onClose}>Annulla</button><ModalSubmitButton label="Crea categoria"/></div></form></section></div>; }
function ModalSubmitButton({ label }: { label: string }) { const { pending } = useFormStatus(); return <button className="admin-action admin-action-primary" disabled={pending}>{pending ? "Salvataggio…" : label}</button>; }
