"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";

const idSchema = z.coerce.number().int().positive();
const categorySchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(300),
  position: z.coerce.number().int().min(0).max(999),
});
const itemSchema = z.object({
  categoryId: idSchema,
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500),
  section: z.string().trim().max(80),
  price: z.preprocess(
    (value) => value === "" || value === null ? null : Number(value),
    z.number().min(0).max(9999).nullable(),
  ),
  allergens: z.string().trim().max(300),
  position: z.coerce.number().int().min(0).max(999),
});

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function finish() {
  updateTag("menu");
  revalidatePath("/admin/menu");
  revalidatePath("/");
}

export async function createCategory(formData: FormData) {
  const values = categorySchema.parse({ name: formData.get("name"), description: formData.get("description") ?? "", position: formData.get("position") });
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("menu_categories").insert({ ...values, slug: slugify(values.name), is_active: true });
  if (error) throw new Error("Impossibile creare la categoria.");
  finish();
}

export async function updateCategory(formData: FormData) {
  const id = idSchema.parse(formData.get("id"));
  const values = categorySchema.parse({ name: formData.get("name"), description: formData.get("description") ?? "", position: formData.get("position") });
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("menu_categories").update({ ...values, slug: slugify(values.name), is_active: formData.get("is_active") === "on" }).eq("id", id);
  if (error) throw new Error("Impossibile aggiornare la categoria.");
  finish();
}

export async function deleteCategory(formData: FormData) {
  const id = idSchema.parse(formData.get("id"));
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("menu_categories").delete().eq("id", id);
  if (error) throw new Error("Impossibile eliminare la categoria.");
  finish();
}

function parseItem(formData: FormData) {
  const values = itemSchema.parse({
    categoryId: formData.get("category_id"), name: formData.get("name"), description: formData.get("description") ?? "",
    price: formData.get("price"), allergens: formData.get("allergens") ?? "", section: formData.get("section") ?? "", position: formData.get("position"),
  });
  return {
    category_id: values.categoryId,
    name: values.name,
    description: values.description || null,
    section: values.section || null,
    price_cents: values.price === null ? null : Math.round(values.price * 100),
    allergens: values.allergens.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean),
    is_vegetarian: formData.get("is_vegetarian") === "on",
    is_available: formData.get("is_available") === "on",
    position: values.position,
  };
}

export async function createItem(formData: FormData) {
  const values = parseItem(formData);
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("menu_items").insert(values);
  if (error) throw new Error("Impossibile creare il prodotto.");
  finish();
}

export async function updateItem(formData: FormData) {
  const id = idSchema.parse(formData.get("id"));
  const values = parseItem(formData);
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("menu_items").update(values).eq("id", id);
  if (error) throw new Error("Impossibile aggiornare il prodotto.");
  finish();
}

export async function deleteItem(formData: FormData) {
  const id = idSchema.parse(formData.get("id"));
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("menu_items").delete().eq("id", id);
  if (error) throw new Error("Impossibile eliminare il prodotto.");
  finish();
}
