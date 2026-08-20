import "server-only";

import { createAuthClient } from "@/lib/supabase/auth-server";

export type AppRole = "admin" | "employee";

export type CurrentProfile = {
  id: string;
  email: string;
  displayName: string | null;
  role: AppRole;
};

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, display_name, role")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.display_name,
    role: profile.role as AppRole,
  };
}

export async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") throw new Error("Operazione non autorizzata");
  return { profile, supabase: await createAuthClient() };
}
