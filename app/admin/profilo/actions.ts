"use server";

import { z } from "zod";
import { createAuthClient } from "@/lib/supabase/auth-server";
import { getCurrentProfile } from "@/lib/auth";

export type ProfileActionState = { ok?: boolean; error?: string };

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12, "La nuova password deve contenere almeno 12 caratteri.").max(128),
  confirmation: z.string(),
}).refine((value) => value.newPassword === value.confirmation, {
  message: "Le nuove password non coincidono.",
  path: ["confirmation"],
}).refine((value) => value.currentPassword !== value.newPassword, {
  message: "La nuova password deve essere diversa da quella attuale.",
  path: ["newPassword"],
});

export async function changePassword(_: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("current_password"),
    newPassword: formData.get("new_password"),
    confirmation: formData.get("confirmation"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Controlla i dati inseriti." };

  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sessione scaduta. Accedi nuovamente." };
  const supabase = await createAuthClient();
  const { error: loginError } = await supabase.auth.signInWithPassword({ email: profile.email, password: parsed.data.currentPassword });
  if (loginError) return { error: "La password attuale non è corretta." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (error) return { error: "Non è stato possibile aggiornare la password." };
  return { ok: true };
}
