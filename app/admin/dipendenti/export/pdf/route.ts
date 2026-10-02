import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSchedulePdf } from "../../schedule-pdf";

export const runtime = "nodejs";
function addDays(value: string, amount: number) { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + amount); return date.toISOString().slice(0, 10); }

export async function GET(request: NextRequest) {
  const week = request.nextUrl.searchParams.get("week") ?? "";
  const employeeIds = (request.nextUrl.searchParams.get("employees") ?? "").split(",").filter(Boolean).map(Number).filter((value) => Number.isInteger(value) && value > 0);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week) || !employeeIds.length) return new Response("Parametri non validi", { status: 400 });
  const { supabase } = await requireAdmin();
  const [employeesResult, shiftsResult] = await Promise.all([
    supabase.from("employees").select("id,first_name,last_name,color").in("id", employeeIds),
    supabase.from("work_shifts").select("employee_id,entry_type,shift_date,start_time,end_time,break_minutes").in("employee_id", employeeIds).eq("approval_status", "approved").gte("shift_date", week).lte("shift_date", addDays(week, 6)).order("shift_date").order("start_time"),
  ]);
  if (employeesResult.error || shiftsResult.error) return new Response("Impossibile generare il PDF", { status: 500 });
  const bytes = await createSchedulePdf({ employees: employeesResult.data ?? [], shifts: shiftsResult.data ?? [], weekStart: week, includeAll: employeeIds.length > 1 });
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="turni-${week}.pdf"`, "Cache-Control": "private, no-store" } });
}
