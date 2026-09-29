"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";

export type NotificationResult = { ok: boolean; error?: string; message?: string };

const safe = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[char]!);

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

export async function setNotificationArchive(formData: FormData): Promise<NotificationResult> {
  const parsed = z.object({
    id: z.coerce.number().int().positive(),
    archived: z.enum(["true", "false"]).transform((value) => value === "true"),
  }).safeParse({ id: formData.get("id"), archived: formData.get("archived") });
  if (!parsed.success) return { ok: false, error: "Notifica non valida" };

  const { supabase, profile } = await requireAdmin();
  const values = parsed.data.archived
    ? { archived_at: new Date().toISOString(), archived_by: profile.id, is_read: true, read_at: new Date().toISOString() }
    : { archived_at: null, archived_by: null, is_read: false, read_at: null };
  const { error } = await supabase.from("admin_notifications").update(values).eq("id", parsed.data.id);
  if (error) return { ok: false, error: "Impossibile aggiornare l'archivio. Esegui notification-archive-migration.sql." };
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

export async function sendTestNotificationEmail(): Promise<NotificationResult> {
  const { supabase, profile } = await requireAdmin();
  const { data: preference, error: preferenceError } = await supabase
    .from("profiles")
    .select("email,receive_email_notifications")
    .eq("id", profile.id)
    .single();

  if (preferenceError || !preference?.email) return { ok: false, error: "Non riesco a leggere l'indirizzo email del profilo." };
  if (!preference.receive_email_notifications) return { ok: false, error: "Attiva prima i promemoria via email." };

  const missing = [
    !process.env.RESEND_API_KEY && "RESEND_API_KEY",
    !process.env.REMINDER_EMAIL_FROM && "REMINDER_EMAIL_FROM",
  ].filter(Boolean);
  if (missing.length) return { ok: false, error: `Configurazione Vercel incompleta: manca ${missing.join(" e ")}.` };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.REMINDER_EMAIL_FROM,
      to: [preference.email],
      subject: "Test notifiche · Il Caffè delle Valli",
      html: `<div style="font-family:Arial,sans-serif;color:#1C1C1A;line-height:1.6"><h1 style="color:#E8650A">Invio configurato correttamente</h1><p>Questa email di prova conferma che il gestionale può inviare notifiche a <strong>${safe(preference.email)}</strong>.</p><p>Data del test: ${safe(new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" }))}</p></div>`,
    }),
  });

  const payload = await response.json().catch(() => null) as { id?: string; message?: string; name?: string } | null;
  if (!response.ok) {
    const providerMessage = payload?.message || payload?.name || `errore HTTP ${response.status}`;
    return { ok: false, error: `Resend ha rifiutato l'invio: ${providerMessage}` };
  }

  return { ok: true, message: `Email di prova inviata a ${preference.email}. Controlla anche Spam e Promozioni.` };
}
