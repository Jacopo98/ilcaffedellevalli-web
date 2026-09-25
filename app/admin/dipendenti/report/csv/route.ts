import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";

function validMonth(value: string | null) { return value && /^20\d{2}-(0[1-9]|1[0-2])$/.test(value) ? value : new Date().toISOString().slice(0, 7); }
function ids(value: string | null) { return [...new Set((value ?? "").split(",").map(Number).filter((id) => Number.isInteger(id) && id > 0))]; }
function mins(value: string) { const [hour, minute] = value.slice(0, 5).split(":").map(Number); return hour * 60 + minute; }
function csv(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }

export async function GET(request: NextRequest) {
  try {
    const { supabase } = await requireAdmin();
    const month = validMonth(request.nextUrl.searchParams.get("month"));
    const selected = ids(request.nextUrl.searchParams.get("employees"));
    const [year, monthNumber] = month.split("-").map(Number);
    const end = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
    let employeeQuery = supabase.from("employees").select("id, first_name, last_name, role_title").order("first_name");
    if (selected.length) employeeQuery = employeeQuery.in("id", selected);
    const { data: employees, error: employeeError } = await employeeQuery;
    if (employeeError) throw employeeError;
    const employeeIds = (employees ?? []).map((employee) => employee.id);
    const { data: shifts, error: shiftError } = employeeIds.length ? await supabase.from("work_shifts").select("employee_id, entry_type, shift_date, start_time, end_time, actual_start_time, actual_end_time, break_minutes, notes").eq("approval_status","approved").in("employee_id", employeeIds).gte("shift_date", `${month}-01`).lte("shift_date", end).order("shift_date").order("start_time") : { data: [], error: null };
    if (shiftError) throw shiftError;
    const employeeMap = new Map((employees ?? []).map((employee) => [employee.id, employee]));
    const header = ["Dipendente", "Mansione", "Data", "Tipologia", "Inizio programmato", "Fine programmata", "Inizio effettivo", "Fine effettiva", "Ore conteggiate", "Note"];
    const typeLabels: Record<string, string> = { work: "Lavoro", extra: "Extra", rol: "ROL", holiday: "Ferie", sick: "Malattia" };
    const rows = (shifts ?? []).map((shift) => { const employee = employeeMap.get(shift.employee_id); const start = shift.actual_start_time || shift.start_time; const finish = shift.actual_end_time || shift.end_time; const worked = Math.max(0, (mins(finish) - mins(start) - shift.break_minutes) / 60); return [employee ? `${employee.first_name} ${employee.last_name}`.trim() : "", employee?.role_title ?? "", shift.shift_date, typeLabels[shift.entry_type] ?? shift.entry_type, shift.start_time.slice(0, 5), shift.end_time.slice(0, 5), shift.actual_start_time?.slice(0, 5) ?? "", shift.actual_end_time?.slice(0, 5) ?? "", worked.toFixed(2).replace(".", ","), shift.notes ?? ""]; });
    const body = [header, ...rows].map((row) => row.map(csv).join(";")).join("\r\n");
    return new Response(`\uFEFF${body}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="riepilogo-paghe-${month}.csv"`, "Cache-Control": "private, no-store" } });
  } catch {
    return new Response("Non autorizzato", { status: 403 });
  }
}
