import Link from "next/link";
import { ArrowLeft, Cloud, ExternalLink, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getDriveConnectionSummary, isDriveConfigured } from "@/lib/google-drive";
import { DriveArchive } from "./drive-archive";

export default async function ArchivePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  let context;
  try { context = await requireAdmin(); } catch { redirect("/admin"); }
  const configured = isDriveConfigured();
  const connection = configured ? await getDriveConnectionSummary(context.profile.id) : null;
  const query = await searchParams;
  return <main className="admin-container drive-archive-page">
    <div className="staff-topbar"><Link className="admin-inline-link" href="/admin"><ArrowLeft size={15} /> Dashboard</Link></div>
    <header className="drive-archive-heading"><div><p className="admin-kicker">Documenti e condivisione</p><h1>Archivio generale</h1><p>Consulta e gestisci la cartella condivisa del Caffè delle Valli direttamente da Google Drive.</p></div>{connection && <div className="drive-connection-actions"><span className="drive-connected"><ShieldCheck size={16}/> {connection.google_email}</span><a href="/api/google-drive/connect">Ricollega account</a></div>}</header>
    {query.error && <div className="staff-alert">{query.error}</div>}
    {!configured ? <section className="drive-setup-card"><span><Cloud /></span><div><p className="admin-kicker">Configurazione richiesta</p><h2>Collega Google Drive</h2><p>L’area è pronta, ma mancano le variabili Google OAuth e l’identificativo della cartella radice su Vercel.</p><code>GOOGLE_DRIVE_CLIENT_ID · GOOGLE_DRIVE_CLIENT_SECRET · GOOGLE_DRIVE_ROOT_FOLDER_ID · GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY</code></div></section>
      : !connection ? <section className="drive-setup-card"><span><Cloud /></span><div><p className="admin-kicker">Autorizzazione personale</p><h2>Accedi con Google</h2><p>Collega l’indirizzo Google invitato come editor della cartella. I permessi effettivi saranno sempre verificati da Google Drive.</p><a className="admin-action admin-action-primary" href="/api/google-drive/connect"><ExternalLink size={16}/> Collega account Google</a></div></section>
      : <DriveArchive googleEmail={connection.google_email}/>} 
  </main>;
}
