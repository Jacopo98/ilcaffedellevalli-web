import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { EmployeeSchedule } from "./employee-schedule";

function isoDate(date: Date) { return date.toISOString().slice(0, 10); }
function mondayOf(value?: string) {
  const parsed = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date();
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  utc.setUTCDate(utc.getUTCDate() - ((utc.getUTCDay() + 6) % 7));
  return utc;
}

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ week?: string; focus?: string }> }) {
  let context;
  try { context = await requireAdmin(); } catch { redirect("/admin"); }
  const params = await searchParams;
  const monday = mondayOf(params.week);
  const sunday = new Date(monday); sunday.setUTCDate(sunday.getUTCDate() + 6);

  const [employeesResult, shiftsResult, accountsResult, requestsResult] = await Promise.all([
    context.supabase.from("employees").select("id, first_name, last_name, phone, email, role_title, hire_date, contract_level, ral_cents, contract_start, contract_end, weekly_contract_hours, notes, color, is_active").order("is_active", { ascending: false }).order("first_name"),
    context.supabase.from("work_shifts").select("id, employee_id, entry_type, shift_date, start_time, end_time, actual_start_time, actual_end_time, break_minutes, notes, approval_status").gte("shift_date", isoDate(monday)).lte("shift_date", isoDate(sunday)).order("shift_date").order("start_time"),
    context.supabase.from("profiles").select("id,email,display_name,employee_id").eq("role","employee").order("display_name"),
    context.supabase.from("shift_change_requests").select("id,employee_id,work_shift_id,request_type,original_date,original_start_time,original_end_time,proposed_date,proposed_start_time,proposed_end_time,notes,status,created_at").eq("status","pending").gte("proposed_date",isoDate(monday)).lte("proposed_date",isoDate(sunday)).order("created_at"),
  ]);
  if (employeesResult.error || shiftsResult.error || accountsResult.error || requestsResult.error) throw new Error("Impossibile caricare dipendenti, turni e richieste. Esegui employee-shift-requests-migration.sql su Supabase.");

  return <EmployeeSchedule employees={employeesResult.data ?? []} shifts={shiftsResult.data ?? []} shiftRequests={requestsResult.data ?? []} employeeAccounts={accountsResult.data ?? []} weekStart={isoDate(monday)} openFullscreen={params.focus === "1"} />;
}
