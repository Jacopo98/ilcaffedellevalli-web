"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Clock3, Download, FileSpreadsheet, MessageCircle, Pencil, Plus, Printer, Users, X } from "lucide-react";
import { createEmployee, createShift, deleteShift, updateEmployee, updateShift, type EmployeeActionResult } from "./actions";

type Employee = { id: number; first_name: string; last_name: string; phone: string | null; email: string | null; role_title: string; hire_date: string | null; weekly_contract_hours: number | null; notes: string | null; color: string; is_active: boolean };
type EntryType = "work" | "rol" | "holiday" | "sick";
type Shift = { id: number; employee_id: number; entry_type: EntryType; shift_date: string; start_time: string; end_time: string; actual_start_time: string | null; actual_end_time: string | null; break_minutes: number; notes: string | null };
type ShiftDraft = { id?: number; employeeId: number; entryType: EntryType; date: string; start: string; end: string; actualStart: string; actualEnd: string; breakMinutes: number; notes: string };
type ShiftCardStyle = CSSProperties & { "--mobile-left": string; "--mobile-width": string; "--mobile-row": number; "--print-top": string; "--print-height": string; "--print-left": string; "--print-width": string };

const DAY_NAMES = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const START_HOUR = 4;
const END_HOUR = 16;
const HOUR_HEIGHT = 54;
const ENTRY_LABELS: Record<EntryType, string> = { work: "Lavoro", rol: "ROL", holiday: "Ferie", sick: "Malattia" };
const ENTRY_COLORS: Record<EntryType, string> = { work: "", rol: "#3978C5", holiday: "#248A73", sick: "#D94F70" };

function fromIso(value: string) { return new Date(`${value}T12:00:00Z`); }
function iso(date: Date) { return date.toISOString().slice(0, 10); }
function addDays(value: string, amount: number) { const date = fromIso(value); date.setUTCDate(date.getUTCDate() + amount); return iso(date); }
function labelDate(value: string) { return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", timeZone: "UTC" }).format(fromIso(value)); }
function minutes(value: string) { const [hour, minute] = value.slice(0, 5).split(":").map(Number); return hour * 60 + minute; }
function time(minutesValue: number) { const safe = Math.max(0, Math.min(1439, minutesValue)); return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`; }
function duration(shift: Shift) { const start = shift.actual_start_time || shift.start_time; const end = shift.actual_end_time || shift.end_time; return Math.max(0, (minutes(end) - minutes(start) - shift.break_minutes) / 60); }
function hoursLabel(value: number) { return `${value.toLocaleString("it-IT", { minimumFractionDigits: value % 1 ? 1 : 0, maximumFractionDigits: 2 })} h`; }
function arrangeShifts(dayShifts: Shift[]) {
  const arranged: { shift: Shift; lane: number; laneCount: number }[] = [];
  let laneEnds: number[] = [];
  let group: { shift: Shift; lane: number; laneCount: number }[] = [];
  let groupEnd = -1;
  const finishGroup = () => { const count = Math.max(1, laneEnds.length); group.forEach((entry) => { entry.laneCount = count; }); };
  [...dayShifts].sort((a, b) => minutes(a.start_time) - minutes(b.start_time)).forEach((shift) => {
    const start = minutes(shift.start_time);
    if (start >= groupEnd) { finishGroup(); laneEnds = []; group = []; }
    let lane = laneEnds.findIndex((end) => end <= start);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(minutes(shift.end_time)); }
    else laneEnds[lane] = minutes(shift.end_time);
    const entry = { shift, lane, laneCount: 1 };
    arranged.push(entry); group.push(entry);
    groupEnd = Math.max(groupEnd, minutes(shift.end_time));
  });
  finishGroup();
  return arranged;
}

export function EmployeeSchedule({ employees, shifts, weekStart }: { employees: Employee[]; shifts: Shift[]; weekStart: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<"calendar" | "employees">("calendar");
  const [draft, setDraft] = useState<ShiftDraft | null>(null);
  const [employeeEditor, setEmployeeEditor] = useState<Employee | "new" | null>(null);
  const [selected, setSelected] = useState<number[]>(employees.filter((employee) => employee.is_active).map((employee) => employee.id));
  const [reportMonth, setReportMonth] = useState(weekStart.slice(0, 7));
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const dragStart = useRef<{ date: string; minute: number } | null>(null);
  const days = useMemo(() => DAY_NAMES.map((name, index) => ({ name, date: addDays(weekStart, index) })), [weekStart]);
  const employeeMap = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);
  const totals = useMemo(() => employees.map((employee) => ({ employee, hours: shifts.filter((shift) => shift.employee_id === employee.id).reduce((sum, shift) => sum + duration(shift), 0) })).filter((entry) => entry.hours > 0 || entry.employee.is_active), [employees, shifts]);

  function run(action: (data: FormData) => Promise<EmployeeActionResult>, data: FormData, close: () => void) {
    setError("");
    startTransition(async () => {
      const result = await action(data);
      if (!result.ok) { setError(result.error || "Operazione non riuscita."); return; }
      close(); router.refresh();
    });
  }
  function newShift(date: string, start = "06:00", end = "10:00") {
    const first = employees.find((employee) => employee.is_active);
    if (!first) { setError("Aggiungi prima un dipendente attivo."); return; }
    setDraft({ employeeId: first.id, entryType: "work", date, start, end, actualStart: "", actualEnd: "", breakMinutes: 0, notes: "" });
  }
  function editShift(shift: Shift) { setDraft({ id: shift.id, employeeId: shift.employee_id, entryType: shift.entry_type, date: shift.shift_date, start: shift.start_time.slice(0, 5), end: shift.end_time.slice(0, 5), actualStart: shift.actual_start_time?.slice(0, 5) ?? "", actualEnd: shift.actual_end_time?.slice(0, 5) ?? "", breakMinutes: shift.break_minutes, notes: shift.notes ?? "" }); }
  function pointerMinute(event: React.PointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const progress = window.innerWidth <= 850 ? (event.clientX - rect.left) / rect.width : (event.clientY - rect.top) / rect.height;
    const raw = START_HOUR * 60 + progress * ((END_HOUR - START_HOUR) * 60);
    return Math.round(raw / 15) * 15;
  }
  function beginDrag(event: React.PointerEvent<HTMLElement>, date: string) {
    if ((event.target as HTMLElement).closest("button")) return;
    dragStart.current = { date, minute: pointerMinute(event) };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function endDrag(event: React.PointerEvent<HTMLElement>, date: string) {
    const start = dragStart.current; dragStart.current = null;
    if (!start || start.date !== date) return;
    const end = pointerMinute(event);
    const from = Math.max(START_HOUR * 60, Math.min(start.minute, end));
    const to = Math.min(END_HOUR * 60, Math.max(start.minute, end, from + 60));
    newShift(date, time(from), time(to));
  }
  function shareText() {
    const chosen = employees.filter((employee) => selected.includes(employee.id));
    const lines = [`Turni · ${labelDate(weekStart)} – ${labelDate(addDays(weekStart, 6))}`, ""];
    chosen.forEach((employee) => {
      lines.push(`*${employee.first_name} ${employee.last_name}*`.trim());
      shifts.filter((shift) => shift.employee_id === employee.id).forEach((shift) => {
        const day = days.find((entry) => entry.date === shift.shift_date);
        lines.push(`${day?.name ?? shift.shift_date}: ${shift.start_time.slice(0, 5)}–${shift.end_time.slice(0, 5)} · ${ENTRY_LABELS[shift.entry_type]}`);
      });
      const total = totals.find((entry) => entry.employee.id === employee.id)?.hours ?? 0;
      lines.push(`Totale: ${hoursLabel(total)}`, "");
    });
    return lines.join("\n");
  }
  function whatsapp() {
    if (!selected.length) { setError("Seleziona almeno un dipendente."); return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText())}`, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="admin-container staff-page">
      <div className="staff-topbar"><Link className="admin-inline-link" href="/admin"><ArrowLeft size={15} /> Dashboard</Link><div className="staff-tabs"><button className={tab === "calendar" ? "active" : ""} onClick={() => setTab("calendar")}><Clock3 size={16} /> Turni</button><button className={tab === "employees" ? "active" : ""} onClick={() => setTab("employees")}><Users size={16} /> Dipendenti</button></div></div>
      <header className="staff-heading"><div><p className="admin-kicker">Organizzazione</p><h1>Dipendenti e turni</h1><p>Programma la settimana, controlla le ore e condividi il calendario.</p></div>{tab === "employees" && <button className="admin-action admin-action-primary" onClick={() => setEmployeeEditor("new")}><Plus size={16} /> Nuovo dipendente</button>}</header>
      {error && <div className="staff-alert"><span>{error}</span><button onClick={() => setError("")}><X size={16} /></button></div>}

      {tab === "calendar" ? <>
        <section className="schedule-toolbar">
          <div className="week-navigation"><Link href={`/admin/dipendenti?week=${addDays(weekStart, -7)}`} aria-label="Settimana precedente"><ChevronLeft /></Link><div><small>Settimana</small><strong>{labelDate(weekStart)} – {labelDate(addDays(weekStart, 6))}</strong></div><Link href={`/admin/dipendenti?week=${addDays(weekStart, 7)}`} aria-label="Settimana successiva"><ChevronRight /></Link></div>
          <div className="schedule-actions"><button onClick={() => window.print()}><Printer size={16} /> Stampa / PDF</button><button onClick={whatsapp}><MessageCircle size={16} /> WhatsApp</button></div>
        </section>
        <section className="share-filter"><div><Download size={17} /><span>Includi nell’esportazione:</span></div><div className="share-employees">{employees.filter((employee) => employee.is_active).map((employee) => <label key={employee.id}><input type="checkbox" checked={selected.includes(employee.id)} onChange={() => setSelected((current) => current.includes(employee.id) ? current.filter((id) => id !== employee.id) : [...current, employee.id])} /><i style={{ background: employee.color }} />{employee.first_name}</label>)}</div></section>
        <div className="schedule-layout">
          <aside className="schedule-hours" aria-hidden="true">{Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => <span style={{ top: index * HOUR_HEIGHT, "--print-top": `${index * 35}px` } as CSSProperties} key={index}>{String(START_HOUR + index).padStart(2, "0")}:00</span>)}</aside>
          <section className="week-calendar">{days.map((day) => {
            const arranged = arrangeShifts(shifts.filter((shift) => shift.shift_date === day.date && selected.includes(shift.employee_id)));
            const mobileRows = Math.max(1, ...arranged.map(({ lane }) => lane + 1));
            return <article className="calendar-day" key={day.date}><header><div><strong>{day.name}</strong><span>{labelDate(day.date)}</span></div><button onClick={() => newShift(day.date)} aria-label={`Aggiungi turno ${day.name}`}><Plus size={17} /></button></header><div className="day-timeline" style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT, "--mobile-rows": mobileRows } as CSSProperties} onPointerDown={(event) => beginDrag(event, day.date)} onPointerUp={(event) => endDrag(event, day.date)}><div className="mobile-time-axis">{Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => START_HOUR + index).map((hour) => <span style={{ left: `${((hour - START_HOUR) / (END_HOUR - START_HOUR)) * 100}%` }} key={hour}>{String(hour).padStart(2, "0")}</span>)}</div>{Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => <i className="mobile-hour-line" style={{ left: `${(index / (END_HOUR - START_HOUR)) * 100}%` }} key={`mobile-${index}`} />)}{Array.from({ length: END_HOUR - START_HOUR }, (_, index) => <i className="hour-line" style={{ top: index * HOUR_HEIGHT, "--print-top": `${index * 35}px` } as CSSProperties} key={index} />)}{arranged.map(({ shift, lane, laneCount }) => { const employee = employeeMap.get(shift.employee_id); const start = minutes(shift.start_time); const end = minutes(shift.end_time); const top = ((start - START_HOUR * 60) / 60) * HOUR_HEIGHT; const height = Math.max(34, ((end - start) / 60) * HOUR_HEIGHT); const horizontalLeft = `calc(${(lane / laneCount) * 100}% + .25rem)`; const horizontalWidth = `calc(${100 / laneCount}% - .5rem)`; const categoryColor = ENTRY_COLORS[shift.entry_type] || employee?.color; const style: ShiftCardStyle = { top, height, left: horizontalLeft, width: horizontalWidth, borderColor: categoryColor, background: `${categoryColor}18`, "--mobile-left": `${((start - START_HOUR * 60) / ((END_HOUR - START_HOUR) * 60)) * 100}%`, "--mobile-width": `${((end - start) / ((END_HOUR - START_HOUR) * 60)) * 100}%`, "--mobile-row": lane, "--print-top": `${((start - START_HOUR * 60) / 60) * 35}px`, "--print-height": `${Math.max(24, ((end - start) / 60) * 35)}px`, "--print-left": horizontalLeft, "--print-width": horizontalWidth }; return <button className={`shift-card shift-type-${shift.entry_type}`} style={style} key={shift.id} onPointerDown={(event) => event.stopPropagation()} onClick={() => editShift(shift)}>{shift.entry_type !== "work" && <em>{ENTRY_LABELS[shift.entry_type]}</em>}<strong>{employee?.first_name}</strong><span>{shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)}</span></button>; })}</div></article>;
          })}</section>
        </div>
        <section className="hours-recap"><div className="recap-heading"><p className="admin-kicker">Riepilogo</p><h2>Ore della settimana</h2></div><div className="recap-grid">{totals.filter(({ employee }) => selected.includes(employee.id)).map(({ employee, hours }) => <article key={employee.id}><i style={{ background: employee.color }} /><div><strong>{employee.first_name} {employee.last_name}</strong><small>{employee.weekly_contract_hours ? `Contratto ${hoursLabel(Number(employee.weekly_contract_hours))}` : "Ore contrattuali non indicate"}</small></div><span>{hoursLabel(hours)}</span></article>)}</div></section>
        <section className="payroll-export"><span className="payroll-icon"><FileSpreadsheet /></span><div><p className="admin-kicker">Studio paghe</p><h2>Recap mensile</h2><p>Genera il riepilogo del mese per i dipendenti selezionati, pronto in PDF o CSV.</p></div><label><span>Mese</span><input type="month" value={reportMonth} onChange={(event) => setReportMonth(event.target.value)} /></label><Link className="admin-action admin-action-primary" href={`/admin/dipendenti/report?month=${reportMonth}&employees=${selected.join(",")}`} target="_blank"><CalendarDays size={16} /> Apri report</Link></section>
      </> : <section className="employee-catalog"><div className="employee-grid">{employees.map((employee) => <article className={`employee-card ${employee.is_active ? "" : "employee-inactive"}`} key={employee.id}><div className="employee-avatar" style={{ background: `${employee.color}1f`, color: employee.color }}>{employee.first_name.charAt(0)}{employee.last_name.charAt(0)}</div><div className="employee-card-main"><span className="employee-state">{employee.is_active ? "Attivo" : "Non attivo"}</span><h2>{employee.first_name} {employee.last_name}</h2><p>{employee.role_title}</p><dl><div><dt>Telefono</dt><dd>{employee.phone || "—"}</dd></div><div><dt>Email</dt><dd>{employee.email || "—"}</dd></div><div><dt>Ore contratto</dt><dd>{employee.weekly_contract_hours ? hoursLabel(Number(employee.weekly_contract_hours)) : "—"}</dd></div></dl></div><button className="employee-edit" onClick={() => setEmployeeEditor(employee)} aria-label={`Modifica ${employee.first_name}`}><Pencil size={16} /></button></article>)}</div></section>}

      {draft && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDraft(null); }}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="shift-title"><button className="modal-close" onClick={() => setDraft(null)}><X /></button><p className="admin-kicker">Calendario</p><h2 id="shift-title">{draft.id ? "Modifica evento" : "Nuovo evento"}</h2><form onSubmit={(event) => { event.preventDefault(); run(draft.id ? updateShift : createShift, new FormData(event.currentTarget), () => setDraft(null)); }} className="admin-edit-grid"><input type="hidden" name="id" value={draft.id ?? ""} /><label className="admin-field"><span>Dipendente</span><select name="employee_id" defaultValue={draft.employeeId}>{employees.filter((employee) => employee.is_active || employee.id === draft.employeeId).map((employee) => <option value={employee.id} key={employee.id}>{employee.first_name} {employee.last_name}</option>)}</select></label><label className="admin-field"><span>Tipologia</span><select name="entry_type" value={draft.entryType} onChange={(event) => setDraft((current) => current ? { ...current, entryType: event.target.value as EntryType } : current)}><option value="work">Turno di lavoro</option><option value="rol">ROL</option><option value="holiday">Ferie a ore</option><option value="sick">Malattia</option></select></label><label className="admin-field"><span>Giorno</span><input name="shift_date" type="date" defaultValue={draft.date} required /></label><label className="admin-field"><span>Pausa (minuti)</span><input name="break_minutes" type="number" min="0" step="5" defaultValue={draft.entryType === "work" ? draft.breakMinutes : 0} disabled={draft.entryType !== "work"} required /></label><label className="admin-field"><span>Inizio</span><input name="start_time" type="time" step="900" defaultValue={draft.start} required /></label><label className="admin-field"><span>Fine</span><input name="end_time" type="time" step="900" defaultValue={draft.end} required /></label>{draft.entryType === "work" && <><label className="admin-field"><span>Inizio effettivo (opzionale)</span><input name="actual_start_time" type="time" step="300" defaultValue={draft.actualStart} /></label><label className="admin-field"><span>Fine effettiva (opzionale)</span><input name="actual_end_time" type="time" step="300" defaultValue={draft.actualEnd} /></label></>}<label className="admin-field admin-field-wide"><span>Note</span><textarea name="notes" defaultValue={draft.notes} rows={2} /></label><div className="modal-actions admin-field-wide">{draft.id && <button type="button" className="admin-action admin-action-danger" disabled={pending} onClick={() => { if (!confirm("Eliminare questo evento?")) return; const data = new FormData(); data.set("id", String(draft.id)); run(deleteShift, data, () => setDraft(null)); }}>Elimina</button>}<button className="admin-action admin-action-primary" disabled={pending}>{pending ? "Salvataggio…" : "Salva evento"}</button></div></form></section></div>}
      {employeeEditor && <EmployeeModal employee={employeeEditor === "new" ? null : employeeEditor} pending={pending} onClose={() => setEmployeeEditor(null)} onSave={(data) => run(employeeEditor === "new" ? createEmployee : updateEmployee, data, () => setEmployeeEditor(null))} />}
    </main>
  );
}

function EmployeeModal({ employee, pending, onClose, onSave }: { employee: Employee | null; pending: boolean; onClose: () => void; onSave: (data: FormData) => void }) {
  return <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="admin-modal admin-modal-wide" role="dialog" aria-modal="true"><button className="modal-close" onClick={onClose}><X /></button><p className="admin-kicker">Anagrafica</p><h2>{employee ? "Modifica dipendente" : "Nuovo dipendente"}</h2><form className="admin-edit-grid" onSubmit={(event) => { event.preventDefault(); onSave(new FormData(event.currentTarget)); }}><input type="hidden" name="id" value={employee?.id ?? ""} /><label className="admin-field"><span>Nome</span><input name="first_name" defaultValue={employee?.first_name ?? ""} required /></label><label className="admin-field"><span>Cognome</span><input name="last_name" defaultValue={employee?.last_name ?? ""} /></label><label className="admin-field"><span>Ruolo / mansione</span><input name="role_title" defaultValue={employee?.role_title ?? "Collaboratore"} required /></label><label className="admin-field"><span>Colore calendario</span><input name="color" type="color" defaultValue={employee?.color ?? "#E8650A"} /></label><label className="admin-field"><span>Telefono</span><input name="phone" type="tel" defaultValue={employee?.phone ?? ""} /></label><label className="admin-field"><span>Email</span><input name="email" type="email" defaultValue={employee?.email ?? ""} /></label><label className="admin-field"><span>Data assunzione</span><input name="hire_date" type="date" defaultValue={employee?.hire_date ?? ""} /></label><label className="admin-field"><span>Ore settimanali contratto</span><input name="weekly_contract_hours" type="number" min="0" max="168" step="0.5" defaultValue={employee?.weekly_contract_hours ?? ""} /></label><label className="admin-field admin-field-wide"><span>Note interne</span><textarea name="notes" rows={3} defaultValue={employee?.notes ?? ""} /></label>{employee && <label className="admin-check"><input name="is_active" type="checkbox" defaultChecked={employee.is_active} /> Dipendente attivo</label>}<div className="modal-actions admin-field-wide"><button type="button" className="admin-action admin-action-secondary" onClick={onClose}>Annulla</button><button className="admin-action admin-action-primary" disabled={pending}>{pending ? "Salvataggio…" : "Salva dipendente"}</button></div></form></section></div>;
}
