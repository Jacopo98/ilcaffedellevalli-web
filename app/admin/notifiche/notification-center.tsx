"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { Archive, ArchiveRestore, ArrowLeft, Bell, CalendarClock, Check, Clock3, Mail, Plus, Send, StickyNote, X } from "lucide-react";
import { createAdminNote, markNotification, sendTestNotificationEmail, setNotificationArchive, updateEmailPreference, type NotificationResult } from "./actions";

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
  archived_at: string | null;
  created_at: string;
};

const displayDate = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString("it-IT");

export function NotificationCenter({ notifications, setupReady, email, emailEnabled, emailPreferenceReady }: { notifications: Notice[]; setupReady: boolean; email: string; emailEnabled: boolean; emailPreferenceReady: boolean }) {
  const router = useRouter();
  const [editor, setEditor] = useState(false);
  const [view, setView] = useState<"active" | "archive">("active");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [emailTestMessage, setEmailTestMessage] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const unreadCount = notifications.filter((notice) => !notice.archived_at && !notice.is_read && (!notice.remind_on || notice.remind_on <= today)).length;
  const activeNotices = notifications.filter((notice) => !notice.archived_at);
  const archivedNotices = notifications.filter((notice) => notice.archived_at);
  const visibleNotices = view === "active" ? activeNotices : archivedNotices;

  function run(action: (data: FormData) => Promise<NotificationResult>, data: FormData, done = () => {}) {
    setError("");
    startTransition(async () => {
      const result = await action(data);
      if (!result.ok) { setError(result.error || "Errore"); return; }
      done();
      router.refresh();
    });
  }

  function testEmail() {
    setError("");
    setEmailTestMessage("");
    startTransition(async () => {
      const result = await sendTestNotificationEmail();
      if (!result.ok) { setError(result.error || "Invio di prova non riuscito"); return; }
      setEmailTestMessage(result.message || "Email di prova inviata.");
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
      <div className="notification-email-tools"><button className="notification-email-test" type="button" disabled={pending || !emailEnabled} onClick={testEmail}><Send size={14}/>{pending ? "Invio…" : "Invia email di prova"}</button><label className="notification-email-toggle"><span>{emailEnabled ? "Attive" : "Disattivate"}</span><input type="checkbox" checked={emailEnabled} disabled={pending || !emailPreferenceReady} onChange={(event) => { const data = new FormData(); data.set("enabled", String(event.target.checked)); run(updateEmailPreference, data); }}/><i/></label></div>
    </section>
    {!emailPreferenceReady && <div className="staff-alert">Esegui notification-email-preferences-migration.sql per attivare le preferenze email.</div>}
    {!setupReady && <div className="staff-alert">Esegui personal-reminders-migration.sql su Supabase.</div>}
    {error && <div className="staff-alert">{error}</div>}
    {emailTestMessage && <div className="notification-test-success"><Check size={16}/>{emailTestMessage}</div>}
    <div className="notification-view-tabs" role="tablist" aria-label="Visualizzazione notifiche">
      <button className={view === "active" ? "active" : ""} onClick={() => setView("active")}><Bell size={15}/> Attive <span>{activeNotices.length}</span></button>
      <button className={view === "archive" ? "active" : ""} onClick={() => setView("archive")}><Archive size={15}/> Archivio <span>{archivedNotices.length}</span></button>
    </div>
    <section className="notification-list">
      {visibleNotices.map((notice) => {
        const scheduled = Boolean(notice.remind_on && notice.remind_on > today);
        const daysToDue = notice.due_date ? Math.ceil((new Date(`${notice.due_date}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86400000) : null;
        const timing = daysToDue === null ? "" : daysToDue < 0 ? "overdue" : daysToDue <= 1 ? "urgent" : daysToDue <= 7 ? "near" : "";
        return <NotificationRow key={notice.id} archived={view === "archive"} canRead={!scheduled && !notice.is_read} onRead={() => { const data = new FormData(); data.set("id", String(notice.id)); run(markNotification, data); }} onArchive={() => { const data = new FormData(); data.set("id", String(notice.id)); data.set("archived", String(view !== "archive")); run(setNotificationArchive, data); }}>
          <article className={`${notice.is_read ? "read" : ""} ${notice.priority === "high" ? "high" : ""} ${scheduled ? "scheduled" : ""} ${timing}`}>
          <span className="notification-icon">{notice.kind === "note" ? <StickyNote/> : <CalendarClock/>}</span>
          <div>
            <small>{notice.kind === "note" ? "Promemoria personale" : "Scadenza pagamento"}{notice.due_date ? ` · scadenza ${displayDate(notice.due_date)}` : ""}</small>
            <h2>{notice.title}</h2>
            {notice.message && <p>{notice.message}</p>}
            {notice.kind === "note" && notice.remind_on && <div className="notification-reminder-meta"><span><Clock3 size={13}/> Avviso dal {displayDate(notice.remind_on)}</span>{notice.email_reminder && <span><Mail size={13}/> Email richiesta</span>}</div>}
          </div>
          <div className="notification-card-actions">{scheduled && <span className="notification-scheduled-badge">Programmato</span>}{!scheduled && !notice.is_read && <button aria-label="Segna come letta" onClick={() => { const data = new FormData(); data.set("id", String(notice.id)); run(markNotification, data); }}><Check/></button>}<button aria-label={view === "archive" ? "Riattiva" : "Archivia"} onClick={() => { const data = new FormData(); data.set("id", String(notice.id)); data.set("archived", String(view !== "archive")); run(setNotificationArchive, data); }}>{view === "archive" ? <ArchiveRestore/> : <Archive/>}</button></div>
          </article>
        </NotificationRow>;
      })}
      {!visibleNotices.length && <div className="notification-empty"><Bell/><h2>{view === "archive" ? "Archivio vuoto" : "Nessuna notifica attiva"}</h2><p>{view === "archive" ? "Le notifiche chiuse rimarranno consultabili qui." : "I tuoi promemoria e le prossime scadenze appariranno qui."}</p></div>}
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

function NotificationRow({ children, archived, canRead, onRead, onArchive }: { children: React.ReactNode; archived: boolean; canRead: boolean; onRead: () => void; onArchive: () => void }) {
  const viewport = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { if (viewport.current) viewport.current.scrollLeft = 72; }, []);
  return <div className="notification-swipe" ref={viewport}>
    <div className="notification-swipe-track">
      <button className="notification-swipe-read" disabled={!canRead || archived} onClick={onRead}><Check size={18}/><span>Letta</span></button>
      {children}
      <button className="notification-swipe-archive" onClick={onArchive}>{archived ? <ArchiveRestore size={18}/> : <Archive size={18}/>}<span>{archived ? "Riattiva" : "Archivia"}</span></button>
    </div>
  </div>;
}
