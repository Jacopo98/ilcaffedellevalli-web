import Link from "next/link";
import { ArrowRight, Banknote, CalendarDays, Coffee, ShieldCheck, Users, WalletCards } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";

export default async function AdminPage() {
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";
  return (
    <main className="admin-container admin-dashboard-main">
      <section className="admin-welcome">
        <div><p className="admin-kicker">Dashboard · {profile?.role}</p><h1>Buon lavoro, <span>{profile?.displayName || "amministratore"}.</span></h1><p>Gestisci da un unico posto le informazioni operative del Caffè delle Valli.</p></div>
      </section>
      {isAdmin && <div className="admin-quick-actions" aria-label="Accessi rapidi">
        <Link href="/admin/dipendenti?focus=1" className="admin-quick-action"><span className="admin-quick-icon"><CalendarDays size={24} /></span><span><small>Accesso rapido</small><strong>Pianificazione turni</strong><em>Apri il calendario ampliato</em></span><ArrowRight className="admin-quick-arrow" size={20} /></Link>
        <Link href="/admin/spese?closing=1" className="admin-quick-action admin-quick-action-closing"><span className="admin-quick-icon"><Banknote size={24} /></span><span><small>Accesso rapido</small><strong>Chiusura giornata</strong><em>Registra l’incasso di oggi</em></span><ArrowRight className="admin-quick-arrow" size={20} /></Link>
      </div>}
      <div className="admin-section-heading"><div><p className="admin-kicker">Strumenti</p><h2>Cosa vuoi gestire?</h2></div><span className="admin-secure-label"><ShieldCheck size={15} /> Sessione protetta</span></div>
      <div className="admin-dashboard-grid">
        {isAdmin ? <Link className="admin-dashboard-card admin-dashboard-card-active" href="/admin/spese"><span className="admin-card-icon"><WalletCards /></span><div><h3>Gestione economica</h3><p>Budget, scadenze, fornitori e andamento mensile.</p><span className="admin-card-link">Apri gestione <ArrowRight size={16} /></span></div></Link> : <div className="admin-dashboard-card admin-dashboard-card-disabled"><span className="admin-card-icon"><WalletCards /></span><div><h3>Gestione economica</h3><p>Permesso riservato all’amministratore.</p></div></div>}
        {isAdmin ? <Link className="admin-dashboard-card admin-dashboard-card-active" href="/admin/dipendenti"><span className="admin-card-icon"><Users /></span><div><h3>Dipendenti e turni</h3><p>Anagrafica, calendario settimanale e riepilogo ore.</p><span className="admin-card-link">Apri gestione <ArrowRight size={16} /></span></div></Link> : <div className="admin-dashboard-card admin-dashboard-card-disabled"><span className="admin-card-icon"><Users /></span><div><h3>Dipendenti e turni</h3><p>Permesso riservato all’amministratore.</p></div></div>}
        {isAdmin ? <Link className="admin-dashboard-card admin-dashboard-card-active" href="/admin/menu"><span className="admin-card-icon"><Coffee /></span><div><h3>Gestione menu</h3><p>Categorie, prodotti, prezzi, allergeni e disponibilità.</p><span className="admin-card-link">Apri gestione <ArrowRight size={16} /></span></div></Link> : <div className="admin-dashboard-card admin-dashboard-card-disabled"><span className="admin-card-icon"><Coffee /></span><div><h3>Gestione menu</h3><p>Permesso riservato all’amministratore.</p></div></div>}
      </div>
    </main>
  );
}
