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

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  let context;
  try { context = await requireAdmin(); } catch { redirect("/admin"); }
  const monday = mondayOf((await searchParams).week);
  const sunday = new Date(monday); sunday.setUTCDate(sunday.getUTCDate() + 6);

  const [employeesResult, shiftsResult] = await Promise.all([
    context.supabase.from("employees").select("id, first_name, last_name, phone, email, role_title, hire_date, contract_level, ral_cents, contract_start, contract_end, weekly_contract_hours, notes, color, is_active").order("is_active", { ascending: false }).order("first_name"),
    context.supabase.from("work_shifts").select("id, employee_id, entry_type, shift_date, start_time, end_time, actual_start_time, actual_end_time, break_minutes, notes").gte("shift_date", isoDate(monday)).lte("shift_date", isoDate(sunday)).order("shift_date").order("start_time"),
  ]);
  if (employeesResult.error || shiftsResult.error) throw new Error("Impossibile caricare dipendenti e turni. Hai eseguito employees-setup.sql su Supabase?");

  return <EmployeeSchedule employees={employeesResult.data ?? []} shifts={shiftsResult.data ?? []} weekStart={isoDate(monday)} />;
}
