import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createAuthClient } from "@/lib/supabase/auth-server";
import { EmployeeShifts } from "./employee-shifts";

function monday(value?:string){const parsed=value&&/^\d{4}-\d{2}-\d{2}$/.test(value)?new Date(`${value}T12:00:00Z`):new Date();const date=Number.isNaN(parsed.getTime())?new Date():parsed;const result=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()));result.setUTCDate(result.getUTCDate()-((result.getUTCDay()+6)%7));return result.toISOString().slice(0,10)}
function addDays(value:string,days:number){const date=new Date(`${value}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10)}

export default async function MyShiftsPage({searchParams}:{searchParams:Promise<{week?:string}>}){
  const profile=await getCurrentProfile(); if(!profile)redirect("/area-riservata"); if(profile.role!=="employee")redirect("/admin/dipendenti");
  const current=monday(); const minWeek=addDays(current,-7); const requested=monday((await searchParams).week); const weekStart=requested<minWeek?minWeek:requested;
  if(!profile.employeeId)return <main className="admin-container employee-portal"><section className="employee-link-missing"><p className="admin-kicker">Associazione richiesta</p><h1>Account non collegato</h1><p>Chiedi all’amministratore di associare il tuo account alla relativa anagrafica dipendente.</p></section></main>;
  const supabase=await createAuthClient();
  const [{data:employee},{data:shifts,error},{data:requests,error:requestsError}]=await Promise.all([supabase.from("employees").select("first_name,last_name").eq("id",profile.employeeId).single(),supabase.from("work_shifts").select("id,entry_type,shift_date,start_time,end_time,notes,approval_status").eq("employee_id",profile.employeeId).gte("shift_date",weekStart).lte("shift_date",addDays(weekStart,6)).order("shift_date").order("start_time"),supabase.from("shift_change_requests").select("id,work_shift_id,request_type,proposed_date,proposed_start_time,proposed_end_time,status").eq("employee_id",profile.employeeId).eq("status","pending").gte("proposed_date",weekStart).lte("proposed_date",addDays(weekStart,6))]);
  if(error||requestsError)throw new Error("Impossibile caricare turni e richieste. Esegui employee-shift-requests-migration.sql su Supabase.");
  return <EmployeeShifts name={employee?.first_name??profile.displayName??""} weekStart={weekStart} minWeek={minWeek} shifts={shifts??[]} requests={requests??[]}/>;
}
