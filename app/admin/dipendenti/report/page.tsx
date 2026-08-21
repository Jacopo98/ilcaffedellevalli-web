import Image from "next/image";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { ReportActions } from "./report-actions";

type Employee = { id: number; first_name: string; last_name: string; weekly_contract_hours: number | null; role_title: string };
type EntryType = "work" | "rol" | "holiday" | "sick";
type Shift = { id: number; employee_id: number; entry_type: EntryType; shift_date: string; start_time: string; end_time: string; actual_start_time: string | null; actual_end_time: string | null; break_minutes: number; notes: string | null };
const ENTRY_LABELS: Record<EntryType, string> = { work: "Lavoro", rol: "ROL", holiday: "Ferie", sick: "Malattia" };

function validMonth(value?: string) { return value && /^20\d{2}-(0[1-9]|1[0-2])$/.test(value) ? value : new Date().toISOString().slice(0, 7); }
function monthRange(month: string) { const [year, value] = month.split("-").map(Number); const end = new Date(Date.UTC(year, value, 0)); return { start: `${month}-01`, end: end.toISOString().slice(0, 10) }; }
function ids(value?: string) { return [...new Set((value ?? "").split(",").map(Number).filter((id) => Number.isInteger(id) && id > 0))]; }
function mins(value: string) { const [hour, minute] = value.slice(0, 5).split(":").map(Number); return hour * 60 + minute; }
function shiftHours(shift: Shift, actual: boolean) { const start = actual && shift.actual_start_time ? shift.actual_start_time : shift.start_time; const end = actual && shift.actual_end_time ? shift.actual_end_time : shift.end_time; return Math.max(0, (mins(end) - mins(start) - shift.break_minutes) / 60); }
function hours(value: number) { return value.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function dateLabel(value: string) { return new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)); }

export default async function PayrollReportPage({ searchParams }: { searchParams: Promise<{ month?: string; employees?: string }> }) {
  let context;
  try { context = await requireAdmin(); } catch { redirect("/admin"); }
  const query = await searchParams;
  const month = validMonth(query.month);
  const selectedIds = ids(query.employees);
  const range = monthRange(month);

  let employeesQuery = context.supabase.from("employees").select("id, first_name, last_name, weekly_contract_hours, role_title").order("first_name");
  if (selectedIds.length) employeesQuery = employeesQuery.in("id", selectedIds);
  const { data: employeesData, error: employeeError } = await employeesQuery;
  const employees = (employeesData ?? []) as Employee[];
  const employeeIds = employees.map((employee) => employee.id);
  let shifts: Shift[] = [];
  if (employeeIds.length) {
    const result = await context.supabase.from("work_shifts").select("id, employee_id, entry_type, shift_date, start_time, end_time, actual_start_time, actual_end_time, break_minutes, notes").in("employee_id", employeeIds).gte("shift_date", range.start).lte("shift_date", range.end).order("shift_date").order("start_time");
    if (result.error) throw new Error("Impossibile caricare i turni mensili.");
    shifts = (result.data ?? []) as Shift[];
  }
  if (employeeError) throw new Error("Impossibile caricare i dipendenti.");
  const monthLabel = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));
  const csvUrl = `/admin/dipendenti/report/csv?month=${month}&employees=${employeeIds.join(",")}`;

  return <><style>{`@media print { @page { size: 210mm 297mm; margin: 12mm 12mm 18mm; } }`}</style><main className="payroll-report">
    <header className="report-header"><div className="report-logo-panel"><Image src="/Logo_black_trasparent.png" alt="Il Caffè delle Valli" width={2843} height={820} priority /></div><div><p>Riepilogo presenze</p><h1>{monthLabel}</h1></div><ReportActions csvUrl={csvUrl} /></header>
    <section className="report-summary"><p>Documento riepilogativo per lo studio paghe</p><span>Generato il {new Intl.DateTimeFormat("it-IT", { dateStyle: "long" }).format(new Date())}</span></section>
    <table className="payroll-summary-table"><thead><tr><th>Dipendente</th><th>Giorni</th><th>Lavoro</th><th>ROL</th><th>Ferie</th><th>Malattia</th><th>Totale</th><th>Contratto sett.</th></tr></thead><tbody>{employees.map((employee) => { const rows = shifts.filter((shift) => shift.employee_id === employee.id); const byType = (type: EntryType) => rows.filter((shift) => shift.entry_type === type).reduce((sum, shift) => sum + shiftHours(shift, true), 0); const total = rows.reduce((sum, shift) => sum + shiftHours(shift, true), 0); const days = new Set(rows.map((shift) => shift.shift_date)).size; return <tr key={employee.id}><td><strong>{employee.first_name} {employee.last_name}</strong></td><td>{days}</td><td>{hours(byType("work"))}</td><td>{hours(byType("rol"))}</td><td>{hours(byType("holiday"))}</td><td>{hours(byType("sick"))}</td><td className="report-highlight">{hours(total)}</td><td>{employee.weekly_contract_hours ? `${hours(Number(employee.weekly_contract_hours))} h` : "—"}</td></tr>; })}</tbody></table>
    <section className="report-details"><h2>Dettaglio eventi</h2>{employees.map((employee) => { const rows = shifts.filter((shift) => shift.employee_id === employee.id); return <div className="report-employee" key={employee.id}><h3>{employee.first_name} {employee.last_name}<span>{hours(rows.reduce((sum, shift) => sum + shiftHours(shift, true), 0))} ore</span></h3>{rows.length ? <table><thead><tr><th>Data</th><th>Tipologia</th><th>Fascia oraria</th><th>Effettivo</th><th>Ore</th><th>Note</th></tr></thead><tbody>{rows.map((shift) => <tr key={shift.id}><td>{dateLabel(shift.shift_date)}</td><td><strong>{ENTRY_LABELS[shift.entry_type]}</strong></td><td>{shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)}</td><td>{shift.entry_type === "work" && shift.actual_start_time && shift.actual_end_time ? `${shift.actual_start_time.slice(0, 5)}–${shift.actual_end_time.slice(0, 5)}` : "—"}</td><td>{hours(shiftHours(shift, true))}</td><td>{shift.notes || "—"}</td></tr>)}</tbody></table> : <p className="report-empty">Nessun evento nel mese selezionato.</p>}</div>; })}</section>
    <footer className="report-footer"><span>Il Caffè delle Valli · Via Provinciale, 6</span><span>Riepilogo interno — verificare i dati prima dell’invio</span></footer>
  </main></>;
}
