import { readFile } from "node:fs/promises";
import path from "node:path";
import { degrees, PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";

export type PdfEmployee = { id: number; first_name: string; last_name: string; color?: string };
export type PdfShift = { employee_id: number; entry_type: string; shift_date: string; start_time: string; end_time: string; break_minutes: number };
const DAYS = ["DOMENICA", "LUNEDI", "MARTEDI", "MERCOLEDI", "GIOVEDI", "VENERDI", "SABATO"];
const TYPES: Record<string, string> = { work: "", extra: "EXTRA", rol: "ROL", holiday: "FERIE", sick: "MALATTIA" };
const orange = rgb(232 / 255, 101 / 255, 10 / 255), ink = rgb(28 / 255, 28 / 255, 26 / 255), muted = rgb(112 / 255, 109 / 255, 103 / 255), grid = rgb(.87, .85, .81);
const START_HOUR = 4, END_HOUR = 16;

function dateLabel(value: string) { const date = new Date(`${value}T12:00:00Z`); return `${DAYS[date.getUTCDay()]} ${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`; }
function minutes(value: string) { const [hour, minute] = value.slice(0, 5).split(":").map(Number); return hour * 60 + minute; }
function duration(shift: PdfShift) { return Math.max(0, minutes(shift.end_time) - minutes(shift.start_time) - shift.break_minutes) / 60; }
function hoursLabel(value: number) { return `${value.toLocaleString("it-IT", { maximumFractionDigits: 2 })} h`; }
function fit(text: string, font: PDFFont, size: number, maxWidth: number) { if (font.widthOfTextAtSize(text, size) <= maxWidth) return text; let result = text; while (result.length > 1 && font.widthOfTextAtSize(`${result}.`, size) > maxWidth) result = result.slice(0, -1); return `${result}.`; }
function color(value?: string): RGB { const hex = /^#[0-9a-f]{6}$/i.test(value ?? "") ? value! : "#E8650A"; return rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255); }
function pale(value: RGB) { return rgb(.9 + value.red * .1, .9 + value.green * .1, .9 + value.blue * .1); }
function addDays(value: string, amount: number) { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + amount); return date.toISOString().slice(0, 10); }
function arrange(shifts: PdfShift[]) { const result: { shift: PdfShift; lane: number; count: number }[] = []; let group: typeof result = [], laneEnds: number[] = [], groupEnd = -1; const finish = () => { const count = Math.max(1, laneEnds.length); group.forEach((entry) => entry.count = count); }; [...shifts].sort((a, b) => minutes(a.start_time) - minutes(b.start_time)).forEach((shift) => { const start = minutes(shift.start_time); if (start >= groupEnd) { finish(); group = []; laneEnds = []; } let lane = laneEnds.findIndex((end) => end <= start); if (lane < 0) { lane = laneEnds.length; laneEnds.push(minutes(shift.end_time)); } else laneEnds[lane] = minutes(shift.end_time); const entry = { shift, lane, count: 1 }; result.push(entry); group.push(entry); groupEnd = Math.max(groupEnd, minutes(shift.end_time)); }); finish(); return result; }

function drawHeader(page: PDFPage, logo: PDFImage, regular: PDFFont, bold: PDFFont, weekStart: string, weekEnd: string, scope: string) {
  const { width, height } = page.getSize();
  page.drawText("ORGANIZZAZIONE", { x: 42, y: height - 45, size: 8, font: bold, color: orange });
  page.drawText("SCHEDULAZIONE TURNI", { x: 42, y: height - 76, size: 24, font: bold, color: ink });
  page.drawText(`Settimana ${dateLabel(weekStart)} - ${dateLabel(weekEnd)}  ·  ${scope}`, { x: 42, y: height - 96, size: 8, font: regular, color: muted });
  const scaled = logo.scaleToFit(132, 38);
  page.drawImage(logo, { x: width - scaled.width - 42, y: height - scaled.height - 40, width: scaled.width, height: scaled.height });
}

export async function createSchedulePdf({ employees, shifts, weekStart, includeAll }: { employees: PdfEmployee[]; shifts: PdfShift[]; weekStart: string; includeAll: boolean }) {
  const pdf = await PDFDocument.create(), regular = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(await readFile(path.join(process.cwd(), "public", "Logo_sfondo_bianco.png"))), page = pdf.addPage([841.89, 595.28]);
  const employeeMap = new Map(employees.map((employee) => [employee.id, employee])), weekEnd = addDays(weekStart, 6);
  drawHeader(page, logo, regular, bold, weekStart, weekEnd, includeAll ? "Calendario completo" : `${employees[0]?.first_name ?? ""} ${employees[0]?.last_name ?? ""}`.trim());
  const left = 42, right = 42, hourWidth = 34, headerHeight = 34, timelineHeight = 312, top = 452;
  const calendarWidth = page.getWidth() - left - right, dayWidth = (calendarWidth - hourWidth) / 7, timelineTop = top - headerHeight, timelineBottom = timelineTop - timelineHeight;
  page.drawRectangle({ x: left, y: timelineBottom, width: calendarWidth, height: timelineHeight + headerHeight, borderColor: grid, borderWidth: 1, color: rgb(1, 1, 1) });
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) { const day = addDays(weekStart, dayIndex), x = left + hourWidth + dayIndex * dayWidth; page.drawRectangle({ x, y: timelineTop, width: dayWidth, height: headerHeight, color: dayIndex >= 5 ? rgb(.96, .94, .91) : rgb(.98, .97, .95), borderColor: grid, borderWidth: .5 }); page.drawText(DAYS[new Date(`${day}T12:00:00Z`).getUTCDay()], { x: x + 7, y: timelineTop + 19, size: 7, font: bold, color: ink }); page.drawText(dateLabel(day).split(" ").at(-1) ?? "", { x: x + 7, y: timelineTop + 8, size: 6, font: regular, color: muted }); page.drawLine({ start: { x, y: timelineBottom }, end: { x, y: timelineTop }, thickness: .5, color: grid }); }
  for (let hour = START_HOUR; hour <= END_HOUR; hour++) { const progress = (hour - START_HOUR) / (END_HOUR - START_HOUR), y = timelineTop - progress * timelineHeight; page.drawLine({ start: { x: left, y }, end: { x: left + calendarWidth, y }, thickness: .45, color: grid }); if (hour < END_HOUR) page.drawText(`${String(hour).padStart(2, "0")}:00`, { x: left + 5, y: y - 3, size: 5.8, font: regular, color: muted }); }
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) { const day = addDays(weekStart, dayIndex); arrange(shifts.filter((shift) => shift.shift_date === day)).forEach(({ shift, lane, count }) => { const employee = employeeMap.get(shift.employee_id), employeeColor = color(employee?.color); const start = Math.max(START_HOUR * 60, minutes(shift.start_time)), end = Math.min(END_HOUR * 60, minutes(shift.end_time)); const shiftTop = timelineTop - ((start - START_HOUR * 60) / ((END_HOUR - START_HOUR) * 60)) * timelineHeight, height = Math.max(14, ((end - start) / ((END_HOUR - START_HOUR) * 60)) * timelineHeight); const laneWidth = dayWidth / count, x = left + hourWidth + dayIndex * dayWidth + lane * laneWidth + 2, width = laneWidth - 4, y = shiftTop - height; page.drawRectangle({ x, y, width, height, color: pale(employeeColor), borderColor: employeeColor, borderWidth: 1 }); const name = employee?.first_name ?? "Dipendente", type = TYPES[shift.entry_type] ?? shift.entry_type.toUpperCase(); if (width < 34) page.drawText(fit(name, bold, 6.2, Math.max(12, height - 7)), { x: x + width / 2 - 2, y: y + 4, size: 6.2, font: bold, color: ink, rotate: degrees(90) }); else { let textY = shiftTop - 9; if (type && height >= 26) { page.drawText(fit(type, bold, 4.7, width - 8), { x: x + 4, y: textY, size: 4.7, font: bold, color: employeeColor }); textY -= 8; } page.drawText(fit(name, bold, 6.5, width - 8), { x: x + 4, y: textY, size: 6.5, font: bold, color: ink }); if (height >= 31) page.drawText(`${shift.start_time.slice(0, 5)}-${shift.end_time.slice(0, 5)}`, { x: x + 4, y: y + 5, size: 5, font: regular, color: muted }); } }); }
  const totals = employees.map((employee) => ({ employee, hours: shifts.filter((shift) => shift.employee_id === employee.id).reduce((sum, shift) => sum + duration(shift), 0) })).filter((entry) => entry.hours > 0); let recapX = left + hourWidth;
  totals.forEach(({ employee, hours }) => { const label = `${employee.first_name} ${hoursLabel(hours)}`, width = Math.min(125, bold.widthOfTextAtSize(label, 6.5) + 18); if (recapX + width > page.getWidth() - right) return; page.drawCircle({ x: recapX + 4, y: timelineBottom - 23, size: 3.2, color: color(employee.color) }); page.drawText(label, { x: recapX + 11, y: timelineBottom - 26, size: 6.5, font: bold, color: ink }); recapX += width; });
  return pdf.save();
}
