"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Save } from "lucide-react";
import { beginAdminOperation, endAdminOperation } from "@/lib/admin-operation-feedback";
import { updateEmployee } from "../actions";

export type EmployeeProfile = { id:number;first_name:string;last_name:string;phone:string|null;email:string|null;tax_code:string|null;iban:string|null;birth_date:string|null;residence_address:string|null;emergency_contact_name:string|null;emergency_contact_phone:string|null;role_title:string;hire_date:string|null;contract_level:string|null;ral_cents:number|null;contract_start:string|null;contract_end:string|null;weekly_contract_hours:number|null;notes:string|null;color:string;is_active:boolean;drive_folder_id:string|null };

export function EmployeeProfileForm({employee}:{employee:EmployeeProfile}){
  const router=useRouter();const [pending,startTransition]=useTransition();const [message,setMessage]=useState("");const [error,setError]=useState("");
  function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setError("");setMessage("");const data=new FormData(event.currentTarget);beginAdminOperation();startTransition(async()=>{try{const result=await updateEmployee(data);if(!result.ok){setError(result.error||"Salvataggio non riuscito");return}setMessage("Anagrafica aggiornata correttamente.");router.refresh()}finally{endAdminOperation()}})}
  return <section className="employee-profile-editor"><div className="employee-profile-section-title"><div><p className="admin-kicker">Anagrafica completa</p><h2>Informazioni del dipendente</h2><p>I dati possono essere aggiornati direttamente da questa pagina.</p></div>{message&&<span><Check size={14}/>{message}</span>}</div>{error&&<div className="staff-alert">{error}</div>}
    <form className="admin-edit-grid employee-profile-form" onSubmit={submit}>
      <input type="hidden" name="id" value={employee.id}/>
      <div className="employee-form-section admin-field-wide"><span>01</span><div><strong>Dati personali</strong><small>Identità e recapiti</small></div></div>
      <label className="admin-field"><span>Nome</span><input name="first_name" defaultValue={employee.first_name} required/></label><label className="admin-field"><span>Cognome</span><input name="last_name" defaultValue={employee.last_name}/></label>
      <label className="admin-field"><span>Codice fiscale</span><input name="tax_code" maxLength={16} defaultValue={employee.tax_code??""}/></label><label className="admin-field"><span>Data di nascita</span><input name="birth_date" type="date" defaultValue={employee.birth_date??""}/></label>
      <label className="admin-field"><span>Telefono</span><input name="phone" type="tel" defaultValue={employee.phone??""}/></label><label className="admin-field"><span>Email</span><input name="email" type="email" defaultValue={employee.email??""}/></label>
      <label className="admin-field admin-field-wide"><span>Indirizzo di residenza</span><input name="residence_address" defaultValue={employee.residence_address??""}/></label>
      <div className="employee-form-section admin-field-wide"><span>02</span><div><strong>Rapporto di lavoro</strong><small>Contratto e trattamento economico</small></div></div>
      <label className="admin-field"><span>Ruolo / mansione</span><input name="role_title" defaultValue={employee.role_title} required/></label><label className="admin-field"><span>Livello contrattuale</span><input name="contract_level" defaultValue={employee.contract_level??""}/></label>
      <label className="admin-field"><span>Data assunzione</span><input name="hire_date" type="date" defaultValue={employee.hire_date??""}/></label><label className="admin-field"><span>Ore settimanali</span><input name="weekly_contract_hours" type="number" min="0" max="168" step="0.5" defaultValue={employee.weekly_contract_hours??""}/></label>
      <label className="admin-field"><span>Inizio contratto</span><input name="contract_start" type="date" defaultValue={employee.contract_start??employee.hire_date??""}/></label><label className="admin-field"><span>Fine contratto</span><input name="contract_end" type="date" defaultValue={employee.contract_end??""}/></label>
      <label className="admin-field"><span>RAL (€)</span><input name="ral" type="text" inputMode="decimal" defaultValue={employee.ral_cents==null?"":(employee.ral_cents/100).toFixed(2)}/></label><label className="admin-field"><span>Colore calendario</span><input name="color" type="color" defaultValue={employee.color}/></label>
      <div className="employee-form-section admin-field-wide"><span>03</span><div><strong>Dati amministrativi</strong><small>Pagamento, emergenze e note</small></div></div>
      <label className="admin-field admin-field-wide"><span>IBAN</span><input name="iban" defaultValue={employee.iban??""}/></label><label className="admin-field"><span>Contatto di emergenza</span><input name="emergency_contact_name" defaultValue={employee.emergency_contact_name??""}/></label><label className="admin-field"><span>Telefono emergenza</span><input name="emergency_contact_phone" type="tel" defaultValue={employee.emergency_contact_phone??""}/></label>
      <label className="admin-field admin-field-wide"><span>Note interne</span><textarea name="notes" rows={4} defaultValue={employee.notes??""}/></label><label className="admin-check admin-field-wide employee-active-check"><input name="is_active" type="checkbox" defaultChecked={employee.is_active}/><span><strong>Dipendente attivo</strong><small>Le anagrafiche non attive restano nello storico.</small></span></label>
      <div className="employee-profile-save admin-field-wide"><button className="admin-action admin-action-primary admin-action-create" disabled={pending}><Save size={16}/><span>{pending?"Salvataggio…":"Salva modifiche"}</span></button></div>
    </form>
  </section>;
}
