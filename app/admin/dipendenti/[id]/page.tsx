import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness, CircleUserRound, FolderLock, Landmark, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getDriveConnectionSummary, isDriveConfigured } from "@/lib/google-drive";
import { EmployeeProfileForm, type EmployeeProfile } from "./profile-form";
import { EmployeeDocuments } from "./employee-documents";

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  let context;
  try { context = await requireAdmin(); } catch { redirect("/admin"); }
  const employeeId = Number((await params).id);
  if (!Number.isInteger(employeeId) || employeeId <= 0) notFound();
  const { data, error } = await context.supabase.from("employees").select("id,first_name,last_name,phone,email,tax_code,iban,birth_date,residence_address,emergency_contact_name,emergency_contact_phone,role_title,hire_date,contract_level,contract_type,intermittent_communication_code,ral_cents,contract_start,contract_end,weekly_contract_hours,notes,color,is_active,drive_folder_id").eq("id", employeeId).single();
  if (error || !data) notFound();
  const employee = data as EmployeeProfile;
  const driveConfigured = isDriveConfigured();
  const connection = driveConfigured ? await getDriveConnectionSummary(context.profile.id) : null;
  const initials = `${employee.first_name.charAt(0)}${employee.last_name.charAt(0)}`;

  return <main className="admin-container employee-profile-page">
    <div className="staff-topbar"><Link className="admin-inline-link" href="/admin/dipendenti?tab=employees"><ArrowLeft size={15}/> Anagrafica dipendenti</Link></div>
    <header className="employee-profile-hero">
      <span className="employee-profile-avatar" style={{background:`${employee.color}1f`,color:employee.color}}>{initials}</span>
      <div><p className="admin-kicker">Profilo del dipendente</p><h1>{employee.first_name} {employee.last_name}</h1><p>{employee.role_title} · {employee.is_active?"Rapporto attivo":"Anagrafica non attiva"}</p></div>
      <span className={`employee-directory-status ${employee.is_active?"active":"inactive"}`}>{employee.is_active?"Attivo":"Non attivo"}</span>
    </header>

    <section className="employee-profile-summary">
      <article><CircleUserRound/><span><small>Codice fiscale</small><strong>{employee.tax_code||"Non indicato"}</strong></span></article>
      <article><BriefcaseBusiness/><span><small>Contratto</small><strong>{employee.contract_type==="fixed_term"?"Tempo determinato":employee.contract_type==="on_call"?"A chiamata":"Tempo indeterminato"}</strong></span></article>
      <article><Phone/><span><small>Telefono</small><strong>{employee.phone||"Non indicato"}</strong></span></article>
      <article><Mail/><span><small>Email</small><strong>{employee.email||"Non indicata"}</strong></span></article>
      <article><MapPin/><span><small>Residenza</small><strong>{employee.residence_address||"Non indicata"}</strong></span></article>
      <article><Landmark/><span><small>IBAN</small><strong>{employee.iban||"Non indicato"}</strong></span></article>
    </section>

    <div className="employee-profile-layout">
      <EmployeeProfileForm employee={employee}/>
      <aside className="employee-profile-aside"><section><FolderLock/><div><p className="admin-kicker">Documenti</p><h2>Cartella personale</h2><p>Contratti, comunicazioni e documentazione del dipendente restano archiviati nella relativa cartella Google Drive.</p></div></section><section><ShieldCheck/><div><h3>Accesso protetto</h3><p>La cartella è disponibile soltanto agli amministratori autorizzati sia nel gestionale sia su Google Drive.</p></div></section></aside>
    </div>

    <EmployeeDocuments employeeId={employee.id} folderId={employee.drive_folder_id} googleEmail={connection?.google_email??null} driveConfigured={driveConfigured}/>
  </main>;
}
