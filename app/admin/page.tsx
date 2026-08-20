import Link from "next/link";
import { ArrowRight, Coffee, ShieldCheck, Users } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";

export default async function AdminPage() {
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";
  return (
    <main className="admin-container admin-dashboard-main">
      <section className="admin-welcome">
        <div><p className="admin-kicker">Dashboard · {profile?.role}</p><h1>Buon lavoro,<br /><span>{profile?.displayName || "amministratore"}.</span></h1><p>Gestisci da un unico posto le informazioni operative del Caffè delle Valli.</p></div>
      </section>
      <div className="admin-section-heading"><div><p className="admin-kicker">Strumenti</p><h2>Cosa vuoi gestire?</h2></div><span className="admin-secure-label"><ShieldCheck size={15} /> Sessione protetta</span></div>
      <div className="admin-dashboard-grid">
        {isAdmin ? <Link className="admin-dashboard-card admin-dashboard-card-active" href="/admin/menu"><span className="admin-card-icon"><Coffee /></span><div><small>Disponibile ora</small><h3>Gestione menu</h3><p>Categorie, prodotti, prezzi, allergeni e disponibilità.</p><span className="admin-card-link">Apri gestione <ArrowRight size={16} /></span></div></Link> : <div className="admin-dashboard-card admin-dashboard-card-disabled"><span className="admin-card-icon"><Coffee /></span><div><h3>Gestione menu</h3><p>Permesso riservato all’amministratore.</p></div></div>}
        <div className="admin-dashboard-card admin-dashboard-card-disabled"><span className="admin-card-icon"><Users /></span><div><small>Prossimamente</small><h3>Collaboratori</h3><p>Utenti, ruoli e permessi del personale.</p></div></div>
      </div>
    </main>
  );
}
