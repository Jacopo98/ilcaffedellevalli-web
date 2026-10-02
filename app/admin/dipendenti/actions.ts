"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";

export type EmployeeActionResult = { ok: boolean; error?: string; message?: string };

const idSchema = z.coerce.number().int().positive();
const dateSchema = z.iso.date();
const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null);
const employeeSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().max(60),
  phone: optionalText(30),
  email: z.union([z.literal(""), z.email().max(254)]).transform((value) => value || null),
  roleTitle: z.string().trim().min(1).max(80),
  hireDate: z.union([z.literal(""), z.iso.date()]).transform((value) => value || null),
  contractLevel: optionalText(80),
  ral: z.union([z.literal(""), z.coerce.number().min(0).max(10000000)]).transform((value) => value === "" ? null : value),
  contractStart: z.union([z.literal(""), z.iso.date()]).transform((value) => value || null),
  contractEnd: z.union([z.literal(""), z.iso.date()]).transform((value) => value || null),
  weeklyHours: z.union([z.literal(""), z.coerce.number().min(0).max(168)]).transform((value) => value === "" ? null : value),
  notes: optionalText(1000),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
}).refine((value) => value.contractEnd === null || value.contractStart === null || value.contractEnd >= value.contractStart, { message: "La fine del contratto non può precedere l’inizio.", path: ["contractEnd"] });
const shiftSchema = z.object({
  employeeId: idSchema,
  entryType: z.enum(["work", "extra", "rol", "holiday", "sick"]),
  shiftDate: z.iso.date(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  breakMinutes: z.coerce.number().int().min(0).max(720),
  actualStartTime: z.union([z.literal(""), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)]).transform((value) => value || null),
  actualEndTime: z.union([z.literal(""), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)]).transform((value) => value || null),
  notes: optionalText(500),
}).refine((value) => value.endTime > value.startTime, { message: "L’orario finale deve essere successivo a quello iniziale." })
  .refine((value) => (!value.actualStartTime && !value.actualEndTime) || (!!value.actualStartTime && !!value.actualEndTime && value.actualEndTime > value.actualStartTime), { message: "Inserisci entrambi gli orari effettivi in modo corretto." });

function refreshSchedule() {
  revalidatePath("/admin/dipendenti");
  revalidatePath("/admin");
  revalidatePath("/admin/spese");
}

function addDays(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function employeeValues(formData: FormData) {
  return employeeSchema.safeParse({
    firstName: formData.get("first_name"), lastName: formData.get("last_name") ?? "", phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "", roleTitle: formData.get("role_title") ?? "Collaboratore", hireDate: formData.get("hire_date") ?? "",
    contractLevel: formData.get("contract_level") ?? "", ral: formData.get("ral") ?? "", contractStart: formData.get("contract_start") ?? "", contractEnd: formData.get("contract_end") ?? "",
    weeklyHours: formData.get("weekly_contract_hours") ?? "", notes: formData.get("notes") ?? "", color: formData.get("color") ?? "#E8650A",
  });
}

export async function createEmployee(formData: FormData): Promise<EmployeeActionResult> {
  const parsed = employeeValues(formData);
  if (!parsed.success) return { ok: false, error: "Controlla i dati inseriti." };
  const { supabase } = await requireAdmin();
  const value = parsed.data;
  const { error } = await supabase.from("employees").insert({ first_name: value.firstName, last_name: value.lastName, phone: value.phone, email: value.email, role_title: value.roleTitle, hire_date: value.hireDate, contract_level: value.contractLevel, ral_cents: value.ral === null ? null : Math.round(value.ral * 100), contract_start: value.contractStart, contract_end: value.contractEnd, weekly_contract_hours: value.weeklyHours, notes: value.notes, color: value.color, is_active: true });
  if (error) return { ok: false, error: error.code === "23505" ? "Questo dipendente è già presente." : "Impossibile creare il dipendente." };
  refreshSchedule();
  return { ok: true };
}

export async function updateEmployee(formData: FormData): Promise<EmployeeActionResult> {
  const id = idSchema.safeParse(formData.get("id"));
  const parsed = employeeValues(formData);
  if (!id.success || !parsed.success) return { ok: false, error: "Controlla i dati inseriti." };
  const { supabase } = await requireAdmin();
  const value = parsed.data;
  const { error } = await supabase.from("employees").update({ first_name: value.firstName, last_name: value.lastName, phone: value.phone, email: value.email, role_title: value.roleTitle, hire_date: value.hireDate, contract_level: value.contractLevel, ral_cents: value.ral === null ? null : Math.round(value.ral * 100), contract_start: value.contractStart, contract_end: value.contractEnd, weekly_contract_hours: value.weeklyHours, notes: value.notes, color: value.color, is_active: formData.get("is_active") === "on" }).eq("id", id.data);
  if (error) return { ok: false, error: error.code === "23505" ? "Esiste già un dipendente con questo nome." : "Impossibile salvare il dipendente." };
  const accountId = String(formData.get("user_account_id") ?? "");
  const { error: unlinkError } = await supabase.from("profiles").update({ employee_id: null }).eq("employee_id", id.data);
  if (unlinkError) return { ok: false, error: "Dipendente salvato, ma associazione account non aggiornata. Esegui employee-portal-migration.sql." };
  if (accountId) {
    const { error: linkError } = await supabase.from("profiles").update({ employee_id: id.data }).eq("id", accountId).eq("role", "employee");
    if (linkError) return { ok: false, error: "Dipendente salvato, ma account non associato." };
  }
  refreshSchedule();
  return { ok: true };
}

function shiftValues(formData: FormData) {
  return shiftSchema.safeParse({ employeeId: formData.get("employee_id"), entryType: formData.get("entry_type") ?? "work", shiftDate: formData.get("shift_date"), startTime: formData.get("start_time"), endTime: formData.get("end_time"), breakMinutes: formData.get("break_minutes") ?? 0, actualStartTime: formData.get("actual_start_time") ?? "", actualEndTime: formData.get("actual_end_time") ?? "", notes: formData.get("notes") ?? "" });
}

function shiftError(code?: string): EmployeeActionResult {
  return { ok: false, error: code === "23P01" ? "Il dipendente ha già un turno sovrapposto in questa giornata." : "Impossibile salvare il turno." };
}

export async function createShift(formData: FormData): Promise<EmployeeActionResult> {
  const parsed = shiftValues(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || "Controlla gli orari inseriti." };
  const { supabase } = await requireAdmin();
  const value = parsed.data;
  const isWork = value.entryType === "work" || value.entryType === "extra";
  const { error } = await supabase.from("work_shifts").insert({ employee_id: value.employeeId, entry_type: value.entryType, shift_date: value.shiftDate, start_time: value.startTime, end_time: value.endTime, actual_start_time: isWork ? value.actualStartTime : null, actual_end_time: isWork ? value.actualEndTime : null, break_minutes: isWork ? value.breakMinutes : 0, notes: value.notes, approval_status: "approved" });
  if (error) return shiftError(error.code);
  refreshSchedule();
  return { ok: true };
}

export async function reviewExtraRequest(formData: FormData): Promise<EmployeeActionResult> {
  const id = idSchema.safeParse(formData.get("id"));
  const decision = z.enum(["approved", "rejected"]).safeParse(formData.get("decision"));
  if (!id.success || !decision.success) return { ok: false, error: "Richiesta non valida." };
  const { supabase, profile } = await requireAdmin();
  const { error } = await supabase.from("work_shifts").update({ approval_status: decision.data, approved_at: new Date().toISOString(), approved_by: profile.id }).eq("id", id.data).eq("entry_type", "extra");
  if (error) return { ok: false, error: "Impossibile aggiornare la richiesta." };
  refreshSchedule(); return { ok: true };
}

export async function reviewShiftChangeRequest(formData: FormData): Promise<EmployeeActionResult> {
  const id=idSchema.safeParse(formData.get("id"));const decision=z.enum(["approved","rejected"]).safeParse(formData.get("decision"));
  if(!id.success||!decision.success)return{ok:false,error:"Richiesta non valida."};
  const {supabase,profile}=await requireAdmin();
  const {data:request,error:readError}=await supabase.from("shift_change_requests").select("id,employee_id,work_shift_id,request_type,proposed_date,proposed_start_time,proposed_end_time,notes,status").eq("id",id.data).eq("status","pending").single();
  if(readError||!request)return{ok:false,error:"Richiesta non più disponibile."};
  if(decision.data==="approved"){
    const operation=request.request_type==="add_extra"
      ? await supabase.from("work_shifts").insert({employee_id:request.employee_id,entry_type:"extra",shift_date:request.proposed_date,start_time:request.proposed_start_time,end_time:request.proposed_end_time,break_minutes:0,notes:request.notes,approval_status:"approved",approved_at:new Date().toISOString(),approved_by:profile.id})
      : await supabase.from("work_shifts").update({shift_date:request.proposed_date,start_time:request.proposed_start_time,end_time:request.proposed_end_time}).eq("id",request.work_shift_id);
    if(operation.error)return shiftError(operation.error.code);
  }
  const {error}=await supabase.from("shift_change_requests").update({status:decision.data,reviewed_by:profile.id,reviewed_at:new Date().toISOString()}).eq("id",id.data).eq("status","pending");
  if(error)return{ok:false,error:"Impossibile completare la revisione."};
  refreshSchedule();return{ok:true};
}

export async function linkEmployeeAccount(formData: FormData): Promise<EmployeeActionResult> {
  const accountId = z.string().uuid().safeParse(formData.get("account_id"));
  const employeeId = z.union([z.literal(""), idSchema]).safeParse(formData.get("employee_id") ?? "");
  if (!accountId.success || !employeeId.success) return { ok: false, error: "Associazione non valida." };
  const { supabase } = await requireAdmin();
  if (employeeId.data !== "") await supabase.from("profiles").update({ employee_id: null }).eq("employee_id", employeeId.data);
  const { error } = await supabase.from("profiles").update({ employee_id: employeeId.data === "" ? null : employeeId.data }).eq("id", accountId.data).eq("role", "employee");
  if (error) return { ok: false, error: "Impossibile associare l'account. Esegui employee-portal-migration.sql." };
  refreshSchedule(); return { ok: true };
}

export async function updateShift(formData: FormData): Promise<EmployeeActionResult> {
  const id = idSchema.safeParse(formData.get("id"));
  const parsed = shiftValues(formData);
  if (!id.success || !parsed.success) return { ok: false, error: parsed.success ? "Turno non valido." : parsed.error.issues[0]?.message };
  const { supabase } = await requireAdmin();
  const value = parsed.data;
  const isWork = value.entryType === "work" || value.entryType === "extra";
  const { error } = await supabase.from("work_shifts").update({ employee_id: value.employeeId, entry_type: value.entryType, shift_date: value.shiftDate, start_time: value.startTime, end_time: value.endTime, actual_start_time: isWork ? value.actualStartTime : null, actual_end_time: isWork ? value.actualEndTime : null, break_minutes: isWork ? value.breakMinutes : 0, notes: value.notes }).eq("id", id.data);
  if (error) return shiftError(error.code);
  refreshSchedule();
  return { ok: true };
}

export async function deleteShift(formData: FormData): Promise<EmployeeActionResult> {
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Turno non valido." };
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("work_shifts").delete().eq("id", id.data);
  if (error) return { ok: false, error: "Impossibile eliminare il turno." };
  refreshSchedule();
  return { ok: true };
}

export async function duplicateWeek(formData: FormData): Promise<EmployeeActionResult> {
  const sourceWeek = dateSchema.safeParse(formData.get("source_week"));
  const targetWeek = dateSchema.safeParse(formData.get("target_week"));
  if (!sourceWeek.success || !targetWeek.success) return { ok: false, error: "Settimana non valida." };

  const { supabase } = await requireAdmin();
  const targetEnd = addDays(targetWeek.data, 6);
  const { count, error: targetError } = await supabase
    .from("work_shifts")
    .select("id", { count: "exact", head: true })
    .gte("shift_date", targetWeek.data)
    .lte("shift_date", targetEnd);
  if (targetError) return { ok: false, error: "Impossibile controllare la settimana di destinazione." };
  if ((count ?? 0) > 0) return { ok: false, error: "La settimana di destinazione contiene già dei turni. Svuotala prima di duplicare." };

  const sourceEnd = addDays(sourceWeek.data, 6);
  const { data: sourceShifts, error: sourceError } = await supabase
    .from("work_shifts")
    .select("employee_id, entry_type, shift_date, start_time, end_time, break_minutes, notes")
    .eq("approval_status", "approved")
    .gte("shift_date", sourceWeek.data)
    .lte("shift_date", sourceEnd)
    .order("shift_date")
    .order("start_time");
  if (sourceError) return { ok: false, error: "Impossibile leggere la settimana da copiare." };
  if (!sourceShifts?.length) return { ok: false, error: "La settimana scelta non contiene turni da duplicare." };

  const dayOffset = Math.round((new Date(`${targetWeek.data}T12:00:00Z`).getTime() - new Date(`${sourceWeek.data}T12:00:00Z`).getTime()) / 86_400_000);
  const rows = sourceShifts.map((shift) => ({
    employee_id: shift.employee_id,
    entry_type: shift.entry_type,
    shift_date: addDays(shift.shift_date, dayOffset),
    start_time: shift.start_time,
    end_time: shift.end_time,
    actual_start_time: null,
    actual_end_time: null,
    break_minutes: shift.break_minutes,
    notes: shift.notes,
  }));
  const { error } = await supabase.from("work_shifts").insert(rows);
  if (error) return shiftError(error.code);
  refreshSchedule();
  return { ok: true };
}

export async function clearWeek(formData: FormData): Promise<EmployeeActionResult> {
  const week = dateSchema.safeParse(formData.get("week"));
  if (!week.success) return { ok: false, error: "Settimana non valida." };
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("work_shifts")
    .delete()
    .gte("shift_date", week.data)
    .lte("shift_date", addDays(week.data, 6));
  if (error) return { ok: false, error: "Impossibile svuotare la settimana." };
  refreshSchedule();
  return { ok: true };
}

const safeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[character]!);
const mailEntryLabels: Record<string, string> = { work: "Turno", extra: "Extra", rol: "ROL", holiday: "Ferie", sick: "Malattia" };

export async function sendWeeklyScheduleEmail(formData: FormData): Promise<EmployeeActionResult> {
  const parsed = z.object({
    week: dateSchema,
    employeeId: idSchema,
    pdfBase64: z.string().min(100).max(9_000_000),
  }).safeParse({ week: formData.get("week"), employeeId: formData.get("employee_id"), pdfBase64: formData.get("pdf_base64") });
  if (!parsed.success) return { ok: false, error: "Destinatario o allegato PDF non valido." };
  const missingEmailVariables = [
    !process.env.RESEND_API_KEY && "RESEND_API_KEY",
    !process.env.REMINDER_EMAIL_FROM && "REMINDER_EMAIL_FROM",
  ].filter(Boolean);
  if (missingEmailVariables.length) return { ok: false, error: `Configurazione email incompleta nell’ambiente corrente: manca ${missingEmailVariables.join(" e ")}. Se stai usando localhost, aggiungila a .env.local; su Vercel controlla l’ambiente Production/Preview e poi esegui un nuovo deploy.` };

  const { supabase } = await requireAdmin();
  const weekEnd = addDays(parsed.data.week, 6);
  const [employeesResult, shiftsResult, adminsResult] = await Promise.all([
    supabase.from("employees").select("id,first_name,last_name,email").eq("id", parsed.data.employeeId).maybeSingle(),
    supabase.from("work_shifts").select("employee_id,entry_type,shift_date,start_time,end_time,break_minutes").eq("approval_status", "approved").gte("shift_date", parsed.data.week).lte("shift_date", weekEnd).order("shift_date").order("start_time"),
    supabase.from("profiles").select("email,employee_id").eq("role", "admin"),
  ]);
  if (employeesResult.error || shiftsResult.error || adminsResult.error) return { ok: false, error: "Impossibile preparare i calendari da inviare." };
  const employee = employeesResult.data;
  if (!employee?.email) return { ok: false, error: "Il dipendente selezionato non ha un indirizzo email." };
  const allShifts = shiftsResult.data ?? [];
  if (!allShifts.some((shift) => shift.employee_id === employee.id)) return { ok: false, error: `${employee.first_name} non ha turni approvati nella settimana.` };
  const allEmployeeIds = [...new Set(allShifts.map((shift) => shift.employee_id))], email = employee.email.trim();
  const { data: allScheduledEmployees, error: allEmployeesError } = allEmployeeIds.length
    ? await supabase.from("employees").select("id,first_name,last_name").in("id", allEmployeeIds)
    : { data: [], error: null };
  if (allEmployeesError) return { ok: false, error: "Impossibile preparare il calendario completo." };
  const adminEmails = new Set((adminsResult.data ?? []).map((profile) => profile.email?.trim().toLowerCase()).filter(Boolean));
  const adminEmployeeIds = new Set((adminsResult.data ?? []).map((profile) => profile.employee_id).filter((value): value is number => typeof value === "number"));
  const isAdmin = adminEmployeeIds.has(employee.id) || adminEmails.has(email.toLowerCase());
  const recipientShifts = isAdmin ? allShifts : allShifts.filter((shift) => shift.employee_id === employee.id);
  const recapEmployees = isAdmin ? (allScheduledEmployees ?? []) : [{ id: employee.id, first_name: employee.first_name, last_name: employee.last_name }];
  const recap = recapEmployees.filter((scheduledEmployee) => recipientShifts.some((shift) => shift.employee_id === scheduledEmployee.id)).map((scheduledEmployee) => {
      const employeeShifts = recipientShifts.filter((shift) => shift.employee_id === scheduledEmployee.id);
      const rows = employeeShifts.map((shift) => `<li style="margin-bottom:6px">${safeHtml(new Date(`${shift.shift_date}T12:00:00Z`).toLocaleDateString("it-IT", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "UTC" }))} · ${safeHtml(shift.start_time.slice(0, 5))}–${safeHtml(shift.end_time.slice(0, 5))} · ${safeHtml(mailEntryLabels[shift.entry_type] ?? shift.entry_type)}</li>`).join("");
      return `<section style="margin:20px 0"><h3 style="margin:0 0 8px;color:#1c1c1a">${safeHtml(`${scheduledEmployee.first_name} ${scheduledEmployee.last_name}`.trim())}:</h3><ul style="margin:0;padding-left:20px">${rows}</ul></section>`;
    }).join("");
  const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.REMINDER_EMAIL_FROM,
        to: [email],
        subject: `Turni della settimana · ${new Date(`${parsed.data.week}T12:00:00Z`).toLocaleDateString("it-IT")}`,
        html: `<div style="font-family:Arial,sans-serif;color:#1c1c1a;line-height:1.5;max-width:680px"><p style="color:#e8650a;font-size:12px;font-weight:700;letter-spacing:2px">ORGANIZZAZIONE</p><h1 style="margin-top:0">Schedulazione turni</h1><p>Ciao <strong>${safeHtml(employee.first_name)}</strong>,</p><p>${isAdmin ? "in qualità di amministratore trovi il calendario completo della settimana" : "ecco il riepilogo dei tuoi turni per la settimana"} dal ${safeHtml(new Date(`${parsed.data.week}T12:00:00Z`).toLocaleDateString("it-IT"))} al ${safeHtml(new Date(`${weekEnd}T12:00:00Z`).toLocaleDateString("it-IT"))}.</p>${recap}<p>In allegato trovi lo stesso PDF disponibile dalla funzione Stampa / PDF ${isAdmin ? "con tutti i turni" : "personale"}.</p><p style="margin-top:28px;color:#777;font-size:12px">Il Caffè delle Valli</p></div>`,
        attachments: [{ filename: `turni-${parsed.data.week}-${isAdmin ? "completo" : employee.first_name.toLowerCase()}.pdf`, content: parsed.data.pdfBase64 }],
      }),
    });
  if (!response.ok) { const payload = await response.json().catch(() => null) as { message?: string } | null; return { ok: false, error: `${employee.first_name}: ${payload?.message ?? `errore ${response.status}`}` }; }
  return { ok: true, message: `Calendario inviato a ${employee.first_name}.` };
}
