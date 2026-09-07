"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAuthClient } from "@/lib/supabase/auth-server";

export type PasswordState = { error?: string };

const schema = z.object({
  password: z.string().min(12, "La password deve contenere almeno 12 caratteri.").max(128),
  confirmation: z.string(),
}).refine((value) => value.password === value.confirmation, {
  message: "Le password non coincidono.",
  path: ["confirmation"],
});

export async function setInitialPassword(_: PasswordState, formData: FormData): Promise<PasswordState> {
  const parsed = schema.safeParse({
    password: formData.get("password"),
    confirmation: formData.get("confirmation"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Controlla la password." };

  const supabase = await createAuthClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Il link non è valido o è scaduto. Richiedi un nuovo invito." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "Non è stato possibile impostare la password. Richiedi un nuovo invito." };
  redirect("/admin");
}
