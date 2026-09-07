import Link from "next/link";
import { ArrowLeft, Mail, UserRound } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { PasswordSettingsForm } from "./password-settings-form";

export default async function ProfilePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/area-riservata");
  return (
    <main className="admin-container profile-page">
      <Link className="admin-inline-link" href="/admin"><ArrowLeft size={15} /> Dashboard</Link>
      <header className="profile-page-heading"><p className="admin-kicker">Account personale</p><h1>Profilo e sicurezza</h1><p>Gestisci le credenziali con cui accedi all’area riservata.</p></header>
      <div className="profile-layout">
        <aside className="profile-identity"><span className="profile-avatar"><UserRound /></span><p className="admin-kicker">Utente</p><h2>{profile.displayName || "Utente"}</h2><dl><div><dt><Mail size={14} /> Email</dt><dd>{profile.email}</dd></div><div><dt>Ruolo</dt><dd className="capitalize">{profile.role}</dd></div></dl></aside>
        <PasswordSettingsForm />
      </div>
    </main>
  );
}
