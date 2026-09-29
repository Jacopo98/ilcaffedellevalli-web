"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";

export type NotificationResult = { ok: boolean; error?: string };

export async function markNotification(formData: FormData): Promise<NotificationResult> {
  const id = z.coerce.number().int().positive().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Notifica non valida" };
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("admin_notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", id.data);
  if (error) return { ok: false, error: "Impossibile aggiornare la notifica" };
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/notifiche");
  return { ok: true };
}

export async function createAdminNote(formData: FormData): Promise<NotificationResult> {
  const parsed = z.object({
    title: z.string().trim().min(1).max(160),
    message: z.string().trim().max(2000),
    due: z.union([z.literal(""), z.iso.date()]).transform((value) => value || null),
    priority: z.enum(["normal", "high"]),
    reminderDays: z.coerce.number().int().min(0).max(365),
    emailReminder: z.boolean(),
  }).safeParse({
    title: formData.get("title"),
    message: formData.get("message") ?? "",
    due: formData.get("due_date") ?? "",
    priority: formData.get("priority") ?? "normal",
    reminderDays: formData.get("reminder_days") ?? 0,
    emailReminder: formData.get("email_reminder") === "on",
  });
  if (!parsed.success) return { ok: false, error: "Controlla i dati del promemoria" };

  const dueDate = parsed.data.due;
  let remindOn: string | null = null;
  if (dueDate) {
    const reminderDate = new Date(`${dueDate}T12:00:00Z`);
    reminderDate.setUTCDate(reminderDate.getUTCDate() - parsed.data.reminderDays);
    remindOn = reminderDate.toISOString().slice(0, 10);
  }
  const today = new Date().toISOString().slice(0, 10);
  const { supabase, profile } = await requireAdmin();
  const { error } = await supabase.from("admin_notifications").insert({
    kind: "note",
    title: parsed.data.title,
    message: parsed.data.message || null,
    due_date: dueDate,
    remind_on: remindOn,
    reminder_days: dueDate ? parsed.data.reminderDays : null,
    email_reminder: dueDate && parsed.data.emailReminder,
    priority: parsed.data.priority,
    created_by: profile.id,
    is_read: Boolean(remindOn && remindOn > today),
  });
  if (error) return { ok: false, error: "Impossibile creare il promemoria. Esegui personal-reminders-migration.sql." };
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/notifiche");
  return { ok: true };
}

export async function updateEmailPreference(formData: FormData): Promise<NotificationResult> {
  const enabled = formData.get("enabled") === "true";
  const { supabase, profile } = await requireAdmin();
  const { error } = await supabase.from("profiles").update({ receive_email_notifications: enabled }).eq("id", profile.id);
  if (error) return { ok: false, error: "Impossibile aggiornare la preferenza email. Esegui la migrazione dedicata." };
  revalidatePath("/admin/notifiche");
  return { ok: true };
}
