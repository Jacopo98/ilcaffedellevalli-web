"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAuthClient } from "@/lib/supabase/auth-server";

export type LoginState = { error?: string };

const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(128),
});

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) return { error: "Inserisci credenziali valide." };

  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) return { error: "Credenziali non valide." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (!profile || !["admin", "employee"].includes(profile.role)) {
    await supabase.auth.signOut();
    return { error: "Profilo non abilitato all’area riservata." };
  }

  redirect("/admin");
}

export async function logout() {
  const supabase = await createAuthClient();
  await supabase.auth.signOut();
  redirect("/");
}
