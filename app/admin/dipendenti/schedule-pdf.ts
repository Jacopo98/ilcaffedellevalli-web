import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

type PdfEmployee = { id: number; first_name: string; last_name: string };
type PdfShift = { employee_id: number; entry_type: string; shift_date: string; start_time: string; end_time: string; break_minutes: number };

const DAYS = ["domenica", "lunedi", "martedi", "mercoledi", "giovedi", "venerdi", "sabato"];
const TYPES: Record<string, string> = { work: "Turno", extra: "Extra", rol: "ROL", holiday: "Ferie", sick: "Malattia" };
const orange = rgb(232 / 255, 101 / 255, 10 / 255);
const ink = rgb(28 / 255, 28 / 255, 26 / 255);
const muted = rgb(112 / 255, 109 / 255, 103 / 255);
const pale = rgb(247 / 255, 244 / 255, 239 / 255);

function dateLabel(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return `${DAYS[date.getUTCDay()]} ${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function duration(shift: PdfShift) {
  const toMinutes = (value: string) => { const [hours, minutes] = value.slice(0, 5).split(":").map(Number); return hours * 60 + minutes; };
  return Math.max(0, toMinutes(shift.end_time) - toMinutes(shift.start_time) - shift.break_minutes) / 60;
}

function hoursLabel(value: number) {
  return `${value.toLocaleString("it-IT", { maximumFractionDigits: 2 })} h`;
}

function fit(text: string, font: PDFFont, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && font.widthOfTextAtSize(`${result}...`, size) > maxWidth) result = result.slice(0, -1);
  return `${result}...`;
}

function drawHeader(page: PDFPage, logo: PDFImage, regular: PDFFont, bold: PDFFont, weekStart: string, weekEnd: string, scope: string) {
  const { width, height } = page.getSize();
  page.drawText("ORGANIZZAZIONE", { x: 42, y: height - 48, size: 9, font: bold, color: orange });
  page.drawText("SCHEDULAZIONE TURNI", { x: 42, y: height - 78, size: 22, font: bold, color: ink });
  page.drawText(`Settimana ${dateLabel(weekStart)} - ${dateLabel(weekEnd)}`, { x: 42, y: height - 98, size: 9, font: regular, color: muted });
  page.drawText(scope, { x: 42, y: height - 114, size: 8, font: bold, color: ink });
  const scaled = logo.scaleToFit(132, 38);
  page.drawImage(logo, { x: width - scaled.width - 42, y: height - scaled.height - 42, width: scaled.width, height: scaled.height });
  page.drawLine({ start: { x: 42, y: height - 128 }, end: { x: width - 42, y: height - 128 }, thickness: 1, color: rgb(.88, .86, .82) });
}

function drawColumns(page: PDFPage, bold: PDFFont, y: number, allEmployees: boolean) {
  page.drawRectangle({ x: 42, y: y - 7, width: page.getWidth() - 84, height: 25, color: ink });
  page.drawText("GIORNO", { x: 53, y, size: 7, font: bold, color: rgb(1, 1, 1) });
  if (allEmployees) page.drawText("DIPENDENTE", { x: 185, y, size: 7, font: bold, color: rgb(1, 1, 1) });
  page.drawText("TIPO", { x: allEmployees ? 390 : 285, y, size: 7, font: bold, color: rgb(1, 1, 1) });
  page.drawText("ORARIO", { x: allEmployees ? 510 : 430, y, size: 7, font: bold, color: rgb(1, 1, 1) });
  page.drawText("ORE", { x: 700, y, size: 7, font: bold, color: rgb(1, 1, 1) });
}

export async function createSchedulePdf({ employees, shifts, weekStart, includeAll }: { employees: PdfEmployee[]; shifts: PdfShift[]; weekStart: string; includeAll: boolean }) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logoBytes = await readFile(path.join(process.cwd(), "public", "Logo_sfondo_bianco.png"));
  const logo = await pdf.embedPng(logoBytes);
  const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));
  const ordered = [...shifts].sort((a, b) => a.shift_date.localeCompare(b.shift_date) || a.start_time.localeCompare(b.start_time));
  const weekEndDate = new Date(`${weekStart}T12:00:00Z`); weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6);
  const weekEnd = weekEndDate.toISOString().slice(0, 10);
  const scope = includeAll ? "Calendario completo" : `${employees[0]?.first_name ?? ""} ${employees[0]?.last_name ?? ""}`.trim();
  let page = pdf.addPage([841.89, 595.28]);
  let y = 430;
  drawHeader(page, logo, regular, bold, weekStart, weekEnd, scope);
  drawColumns(page, bold, y, includeAll);
  y -= 30;

  for (let index = 0; index < ordered.length; index++) {
    if (y < 62) {
      page = pdf.addPage([841.89, 595.28]);
      drawHeader(page, logo, regular, bold, weekStart, weekEnd, scope);
      y = 430;
      drawColumns(page, bold, y, includeAll);
      y -= 30;
    }
    const shift = ordered[index];
    const employee = employeeMap.get(shift.employee_id);
    if (index % 2 === 0) page.drawRectangle({ x: 42, y: y - 9, width: page.getWidth() - 84, height: 28, color: pale });
    page.drawText(dateLabel(shift.shift_date), { x: 53, y, size: 8, font: bold, color: ink });
    if (includeAll) page.drawText(fit(`${employee?.first_name ?? ""} ${employee?.last_name ?? ""}`.trim(), regular, 8, 180), { x: 185, y, size: 8, font: regular, color: ink });
    page.drawText(TYPES[shift.entry_type] ?? shift.entry_type, { x: includeAll ? 390 : 285, y, size: 8, font: regular, color: muted });
    page.drawText(`${shift.start_time.slice(0, 5)} - ${shift.end_time.slice(0, 5)}`, { x: includeAll ? 510 : 430, y, size: 8, font: regular, color: ink });
    page.drawText(hoursLabel(duration(shift)), { x: 700, y, size: 8, font: bold, color: ink });
    y -= 30;
  }

  if (!ordered.length) page.drawText("Nessun turno programmato nella settimana.", { x: 53, y, size: 10, font: regular, color: muted });
  const total = ordered.reduce((sum, shift) => sum + duration(shift), 0);
  page.drawText(`Totale ore: ${hoursLabel(total)}`, { x: 650, y: Math.max(38, y - 4), size: 10, font: bold, color: orange });
  return pdf.save();
}
