"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth";
import { createAuthClient } from "@/lib/supabase/auth-server";

export type ExtraRequestResult = { ok: boolean; error?: string };

const schema = z.object({
  date: z.iso.date(),
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  notes: z.string().trim().max(500).transform((value) => value || null),
}).refine((value) => value.end > value.start, { message: "L'orario finale deve essere successivo a quello iniziale." });

export async function requestExtraHours(formData: FormData): Promise<ExtraRequestResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "employee" || !profile.employeeId) return { ok: false, error: "Account non associato a un dipendente." };
  const parsed = schema.safeParse({ date: formData.get("shift_date"), start: formData.get("start_time"), end: formData.get("end_time"), notes: formData.get("notes") ?? "" });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Controlla i dati inseriti." };
  const today = new Date().toISOString().slice(0, 10);
  if (parsed.data.date < today) return { ok: false, error: "Puoi inserire ore extra soltanto per oggi o per una data futura." };
  const supabase = await createAuthClient();
  const { error } = await supabase.from("shift_change_requests").insert({ employee_id: profile.employeeId, request_type: "add_extra", proposed_date: parsed.data.date, proposed_start_time: parsed.data.start, proposed_end_time: parsed.data.end, notes: parsed.data.notes, status: "pending" });
  if (error) return { ok: false, error: "Impossibile inviare la richiesta. Esegui employee-shift-requests-migration.sql." };
  revalidatePath("/admin/i-miei-turni");
  revalidatePath("/admin/dipendenti");
  return { ok: true };
}

export async function requestShiftChange(formData: FormData): Promise<ExtraRequestResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "employee" || !profile.employeeId) return { ok:false,error:"Account non associato a un dipendente." };
  const shiftId=z.coerce.number().int().positive().safeParse(formData.get("shift_id"));
  const parsed=schema.safeParse({date:formData.get("shift_date"),start:formData.get("start_time"),end:formData.get("end_time"),notes:formData.get("notes")??""});
  if(!shiftId.success||!parsed.success)return{ok:false,error:parsed.success?"Turno non valido.":parsed.error.issues[0]?.message};
  const today=new Date().toISOString().slice(0,10); if(parsed.data.date<today)return{ok:false,error:"Non puoi richiedere modifiche per una data passata."};
  const supabase=await createAuthClient();
  const {data:shift,error:shiftError}=await supabase.from("work_shifts").select("id,shift_date,start_time,end_time").eq("id",shiftId.data).eq("employee_id",profile.employeeId).single();
  if(shiftError||!shift)return{ok:false,error:"Turno non disponibile."};
  const {error}=await supabase.from("shift_change_requests").insert({employee_id:profile.employeeId,work_shift_id:shift.id,request_type:"change_shift",original_date:shift.shift_date,original_start_time:shift.start_time,original_end_time:shift.end_time,proposed_date:parsed.data.date,proposed_start_time:parsed.data.start,proposed_end_time:parsed.data.end,notes:parsed.data.notes,status:"pending"});
  if(error)return{ok:false,error:error.code==="23505"?"Esiste già una modifica in attesa per questo turno.":"Impossibile inviare la modifica."};
  revalidatePath("/admin/i-miei-turni");revalidatePath("/admin/dipendenti");return{ok:true};
}
