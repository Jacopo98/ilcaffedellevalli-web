"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Bell, CalendarClock, Check, Clock3, Mail, Plus, StickyNote, X } from "lucide-react";
import { createAdminNote, markNotification, updateEmailPreference, type NotificationResult } from "./actions";

type Notice = {
  id: number;
  kind: "payment_due" | "note" | "system";
  title: string;
  message: string | null;
  due_date: string | null;
  remind_on: string | null;
  reminder_days: number | null;
  email_reminder: boolean;
  priority: "normal" | "high";
  is_read: boolean;
  created_at: string;
};

const displayDate = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString("it-IT");

export function NotificationCenter({ notifications, setupReady, email, emailEnabled, emailPreferenceReady }: { notifications: Notice[]; setupReady: boolean; email: string; emailEnabled: boolean; emailPreferenceReady: boolean }) {
  const router = useRouter();
  const [editor, setEditor] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const unreadCount = notifications.filter((notice) => !notice.is_read && (!notice.remind_on || notice.remind_on <= today)).length;

  function run(action: (data: FormData) => Promise<NotificationResult>, data: FormData, done = () => {}) {
    setError("");
    startTransition(async () => {
      const result = await action(data);
      if (!result.ok) { setError(result.error || "Errore"); return; }
      done();
      router.refresh();
    });
  }

  return <main className="admin-container notifications-page">
    <div className="staff-topbar">
      <Link className="admin-inline-link" href="/admin"><ArrowLeft size={15}/> Dashboard</Link>
      <button className="admin-action admin-action-primary admin-action-create" onClick={() => setEditor(true)}><Plus size={15}/> Nuovo promemoria</button>
    </div>
    <header className="staff-heading">
      <div><p className="admin-kicker">Centro amministrativo</p><h1>Notifiche e note</h1><p>Scadenze imminenti, promemoria personali e annotazioni interne.</p></div>
      <div className="notification-count"><Bell/><strong>{unreadCount}</strong><span>da leggere</span></div>
    </header>
    <section className="notification-email-preference">
      <div><strong>Promemoria via email</strong><p>Ricevi su {email} sia le scadenze dei pagamenti sia i tuoi promemoria personali.</p></div>
      <label className="notification-email-toggle"><span>{emailEnabled ? "Attive" : "Disattivate"}</span><input type="checkbox" checked={emailEnabled} disabled={pending || !emailPreferenceReady} onChange={(event) => { const data = new FormData(); data.set("enabled", String(event.target.checked)); run(updateEmailPreference, data); }}/><i/></label>
    </section>
    {!emailPreferenceReady && <div className="staff-alert">Esegui notification-email-preferences-migration.sql per attivare le preferenze email.</div>}
    {!setupReady && <div className="staff-alert">Esegui personal-reminders-migration.sql su Supabase.</div>}
    {error && <div className="staff-alert">{error}</div>}
    <section className="notification-list">
      {notifications.map((notice) => {
        const scheduled = Boolean(notice.remind_on && notice.remind_on > today);
        return <article className={`${notice.is_read ? "read" : ""} ${notice.priority === "high" ? "high" : ""} ${scheduled ? "scheduled" : ""}`} key={notice.id}>
          <span className="notification-icon">{notice.kind === "note" ? <StickyNote/> : <CalendarClock/>}</span>
          <div>
            <small>{notice.kind === "note" ? "Promemoria personale" : "Scadenza pagamento"}{notice.due_date ? ` · scadenza ${displayDate(notice.due_date)}` : ""}</small>
            <h2>{notice.title}</h2>
            {notice.message && <p>{notice.message}</p>}
            {notice.kind === "note" && notice.remind_on && <div className="notification-reminder-meta"><span><Clock3 size={13}/> Avviso dal {displayDate(notice.remind_on)}</span>{notice.email_reminder && <span><Mail size={13}/> Email richiesta</span>}</div>}
          </div>
          {!scheduled && !notice.is_read && <button aria-label="Segna come letta" onClick={() => { const data = new FormData(); data.set("id", String(notice.id)); run(markNotification, data); }}><Check/></button>}
          {scheduled && <span className="notification-scheduled-badge">Programmato</span>}
        </article>;
      })}
      {!notifications.length && <div className="notification-empty"><Bell/><h2>Nessuna notifica</h2><p>I tuoi promemoria e le prossime scadenze appariranno qui.</p></div>}
    </section>
    {editor && <div className="admin-modal-backdrop"><section className="admin-modal">
      <button className="modal-close" onClick={() => setEditor(false)}><X/></button>
      <p className="admin-kicker">Promemoria personale</p><h2>Nuova nota</h2>
      <p className="employee-extra-intro">Scegli una scadenza e con quanto anticipo vuoi ricevere l’avviso.</p>
      <form className="admin-edit-grid" onSubmit={(event) => { event.preventDefault(); run(createAdminNote, new FormData(event.currentTarget), () => setEditor(false)); }}>
        <label className="admin-field admin-field-wide"><span>Titolo</span><input name="title" required/></label>
        <label className="admin-field"><span>Scadenza <small>(facoltativa)</small></span><input name="due_date" type="date"/></label>
        <label className="admin-field"><span>Avvisami</span><select name="reminder_days" defaultValue="3"><option value="0">Il giorno della scadenza</option><option value="1">1 giorno prima</option><option value="3">3 giorni prima</option><option value="7">7 giorni prima</option><option value="14">14 giorni prima</option><option value="30">30 giorni prima</option></select></label>
        <label className="admin-field"><span>Priorità</span><select name="priority"><option value="normal">Normale</option><option value="high">Alta</option></select></label>
        <label className="admin-check notification-email-request"><input name="email_reminder" type="checkbox" defaultChecked/><span><strong>Invia anche via email</strong><small>{emailEnabled ? `All’indirizzo ${email}` : "Richiede l’attivazione dei promemoria email qui sopra"}</small></span></label>
        <label className="admin-field admin-field-wide"><span>Nota</span><textarea name="message" rows={4}/></label>
        <div className="modal-actions admin-field-wide"><button type="button" className="admin-action admin-action-secondary" onClick={() => setEditor(false)}>Annulla</button><button className="admin-action admin-action-primary" disabled={pending}>{pending ? "Salvataggio…" : "Salva promemoria"}</button></div>
      </form>
    </section></div>}
  </main>;
}
