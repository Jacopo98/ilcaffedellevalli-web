"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";

export type InvoiceActionResult = { ok: boolean; error?: string; message?: string };
type XmlNode = Record<string, unknown>;

const array = <T,>(value: T | T[] | undefined): T[] => value === undefined ? [] : Array.isArray(value) ? value : [value];
const obj = (value: unknown): XmlNode => value && typeof value === "object" ? value as XmlNode : {};
const text = (value: unknown) => value === undefined || value === null ? "" : String(value).trim();
const numberValue = (value: unknown) => { const parsed = Number(text(value).replace(",", ".")); return Number.isFinite(parsed) ? parsed : 0; };
const cents = (value: unknown) => Math.round(numberValue(value) * 100);
const CREDIT_NOTE_TYPES = new Set(["TD04", "TD08"]);
const dateValue = (value: unknown) => { const parsed = text(value); return /^\d{4}-\d{2}-\d{2}$/.test(parsed) ? parsed : null; };
const partyName = (party: XmlNode) => { const registry = obj(obj(party.DatiAnagrafici).Anagrafica); return text(registry.Denominazione) || [text(registry.Nome), text(registry.Cognome)].filter(Boolean).join(" "); };
const address = (party: XmlNode) => { const site = obj(party.Sede); return [text(site.Indirizzo), text(site.NumeroCivico), text(site.CAP), text(site.Comune), text(site.Provincia), text(site.Nazione)].filter(Boolean).join(", "); };
const decimalSchema = z.preprocess((value) => String(value ?? "").trim().replace(",", "."), z.coerce.number().min(0));

const manualInvoiceSchema = z.object({
  document_type: z.enum(["TD01", "TD04"]),
  supplier_name: z.string().trim().min(1).max(160),
  supplier_vat_number: z.string().trim().min(5).max(32),
  invoice_number: z.string().trim().min(1).max(80),
  issue_date: z.iso.date(),
  taxable_amount: decimalSchema,
  vat_rate: decimalSchema.refine((value) => value <= 100),
  due_date: z.union([z.literal(""), z.iso.date()]).transform((value) => value || null),
  payment_method: z.string().trim().max(8).transform((value) => value || null),
  payment_status: z.enum(["unpaid", "paid"]),
  description: z.string().trim().max(500).transform((value) => value || null),
});

function paymentDetails(body: XmlNode) {
  return array(body.DatiPagamento as XmlNode | XmlNode[] | undefined).flatMap((value, groupIndex) => {
    const group = obj(value);
    const terms = text(group.CondizioniPagamento) || null;
    return array(group.DettaglioPagamento as XmlNode | XmlNode[] | undefined).map((value, installmentIndex) => {
      const row = obj(value);
      return {
        payment_group_number: groupIndex + 1,
        installment_number: installmentIndex + 1,
        payment_terms: terms,
        method_code: text(row.ModalitaPagamento) || null,
        due_date: dateValue(row.DataScadenzaPagamento),
        reference_date: dateValue(row.DataRiferimentoTerminiPagamento),
        payment_days: text(row.GiorniTerminiPagamento) ? Math.round(numberValue(row.GiorniTerminiPagamento)) : null,
        amount_cents: text(row.ImportoPagamento) ? cents(row.ImportoPagamento) : null,
        beneficiary: text(row.Beneficiario) || null,
        bank_name: text(row.IstitutoFinanziario) || null,
        iban: text(row.IBAN) || null,
        abi: text(row.ABI) || null,
        cab: text(row.CAB) || null,
        bic: text(row.BIC) || null,
        postal_office_code: text(row.CodUfficioPostale) || null,
        payee_first_name: text(row.NomeQuietanzante) || null,
        payee_last_name: text(row.CognomeQuietanzante) || null,
        payee_tax_code: text(row.CFQuietanzante) || null,
        payee_title: text(row.TitoloQuietanzante) || null,
        payment_code: text(row.CodicePagamento) || null,
        discount_cents: text(row.ScontoPagamentoAnticipato) ? cents(row.ScontoPagamentoAnticipato) : null,
        early_discount_due_date: dateValue(row.DataLimitePagamentoAnticipato),
        penalty_cents: text(row.PenalitaPagamentiRitardati) ? cents(row.PenalitaPagamentiRitardati) : null,
        penalty_due_date: dateValue(row.DataDecorrenzaPenale),
      };
    });
  });
}

export async function importSupplierInvoices(formData: FormData): Promise<InvoiceActionResult> {
  const files = formData.getAll("invoice_files").filter((item): item is File => item instanceof File && item.size > 0);
  if (!files.length) return { ok: false, error: "Seleziona almeno un file XML." };
  if (files.length > 20) return { ok: false, error: "Puoi importare al massimo 20 file per volta." };

  const { supabase } = await requireAdmin();
  const { data: category } = await supabase.from("expense_categories").select("id").eq("name", "Fatture fornitori").single();
  if (!category) return { ok: false, error: "Esegui supplier-invoices-migration.sql prima dell’importazione." };

  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: true,
    isArray: (name) => ["FatturaElettronicaBody", "DettaglioLinee", "DatiRiepilogo", "DatiPagamento", "DettaglioPagamento", "CodiceArticolo"].includes(name),
  });
  let imported = 0;
  let enriched = 0;

  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(".xml") || file.size > 8_000_000) return { ok: false, error: `${file.name}: file non valido o superiore a 8 MB.` };
    const xmlText = await file.text();
    let root: XmlNode;
    try { root = obj(parser.parse(xmlText).FatturaElettronica); } catch { return { ok: false, error: `${file.name}: XML non leggibile.` }; }

    const header = obj(root.FatturaElettronicaHeader);
    const supplier = obj(header.CedentePrestatore);
    const customer = obj(header.CessionarioCommittente);
    const supplierVat = obj(obj(supplier.DatiAnagrafici).IdFiscaleIVA);
    const customerVat = obj(obj(customer.DatiAnagrafici).IdFiscaleIVA);
    const bodies = array(root.FatturaElettronicaBody as XmlNode | XmlNode[] | undefined);

    for (let bodyIndex = 0; bodyIndex < bodies.length; bodyIndex++) {
      const body = obj(bodies[bodyIndex]);
      const general = obj(obj(body.DatiGenerali).DatiGeneraliDocumento);
      const goods = obj(body.DatiBeniServizi);
      const lines = array(goods.DettaglioLinee as XmlNode | XmlNode[] | undefined).map(obj);
      const vatRows = array(goods.DatiRiepilogo as XmlNode | XmlNode[] | undefined).map(obj);
      const payments = paymentDetails(body);
      const supplierVatNumber = text(supplierVat.IdCodice);
      const invoiceNumber = text(general.Numero);
      const issueDate = text(general.Data);
      const documentType = text(general.TipoDocumento);
      const documentSign = CREDIT_NOTE_TYPES.has(documentType) ? -1 : 1;
      if (!supplierVatNumber || !invoiceNumber || !/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) return { ok: false, error: `${file.name}: dati identificativi della fattura mancanti.` };

      const taxable = vatRows.reduce((sum, row) => sum + cents(row.ImponibileImporto), 0);
      const vat = vatRows.reduce((sum, row) => sum + cents(row.Imposta), 0);
      const total = cents(general.ImportoTotaleDocumento) || taxable + vat;
      const hash = createHash("sha256").update(xmlText).update(String(bodyIndex)).digest("hex");
      const dueDates = payments.map((row) => row.due_date).filter((value): value is string => Boolean(value)).sort();
      const primaryMethod = payments.find((row) => row.method_code)?.method_code ?? null;
      const { data: existing } = await supabase.from("supplier_invoices").select("id,due_date,expense_id").or(`source_hash.eq.${hash},and(supplier_vat_number.eq.${supplierVatNumber},invoice_number.eq.${invoiceNumber},issue_date.eq.${issueDate})`).maybeSingle();

      if (existing) {
        const { error: deleteError } = await supabase.from("supplier_invoice_payments").delete().eq("invoice_id", existing.id);
        if (deleteError) return { ok: false, error: "Esegui supplier-invoice-payments-migration.sql prima di reimportare le fatture." };
        if (payments.length) {
          const { error: paymentError } = await supabase.from("supplier_invoice_payments").insert(payments.map((row) => ({ ...row, invoice_id: existing.id })));
          if (paymentError) {
            console.error("Supplier invoice payment update failed", { file: file.name, code: paymentError.code, message: paymentError.message });
            const schemaError = paymentError.code === "42P01" || paymentError.code === "42703";
            return { ok: false, error: schemaError ? `${file.name}: struttura dei pagamenti incompleta. Riesegui supplier-invoice-payments-migration.sql.` : `${file.name}: impossibile salvare i dettagli di pagamento (codice ${paymentError.code || "sconosciuto"}).` };
          }
        }
        const dueDate = existing.due_date ?? dueDates.at(-1) ?? null;
        await supabase.from("supplier_invoices").update({ payment_method: primaryMethod, due_date: dueDate }).eq("id", existing.id);
        if (existing.expense_id) {
          const { error: expenseUpdateError } = await supabase.from("expenses").update({
            due_date: dueDate,
            amount_net_cents: documentSign * taxable,
            vat_cents: documentSign * vat,
          }).eq("id", existing.expense_id);
          if (expenseUpdateError) {
            console.error("Supplier credit-note expense update failed", { file: file.name, code: expenseUpdateError.code, message: expenseUpdateError.message });
            return { ok: false, error: CREDIT_NOTE_TYPES.has(documentType) ? `${file.name}: nota di credito riconosciuta, ma il database non accetta ancora importi negativi. Esegui supplier-credit-notes-migration.sql.` : `${file.name}: impossibile aggiornare il movimento collegato.` };
          }
        }
        enriched++;
        continue;
      }

      const { data: invoice, error: invoiceError } = await supabase.from("supplier_invoices").insert({
        source_hash: hash, source_filename: file.name, document_type: documentType, invoice_number: invoiceNumber, issue_date: issueDate,
        currency: text(general.Divisa) || "EUR", supplier_name: partyName(supplier), supplier_vat_country: text(supplierVat.IdPaese), supplier_vat_number: supplierVatNumber,
        supplier_tax_code: text(obj(supplier.DatiAnagrafici).CodiceFiscale) || null, supplier_address: address(supplier) || null, customer_name: partyName(customer),
        customer_vat_number: text(customerVat.IdCodice) || null, customer_tax_code: text(obj(customer.DatiAnagrafici).CodiceFiscale) || null, customer_address: address(customer) || null,
        description: array(general.Causale as string | string[] | undefined).map(text).filter(Boolean).join(" · ") || null,
        taxable_cents: taxable, vat_cents: vat, total_cents: total, due_date: dueDates.at(-1) || null, payment_status: "unpaid", payment_method: primaryMethod,
      }).select("id").single();
      if (invoiceError || !invoice) return { ok: false, error: `${file.name}: impossibile salvare la fattura.` };

      const { data: expense, error: expenseError } = await supabase.from("expenses").insert({
        category_id: category.id, description: `Fattura ${invoiceNumber} · ${partyName(supplier)}`, supplier: partyName(supplier), invoice_number: invoiceNumber,
        is_invoice: true, accounting_label: "F", expense_date: issueDate, due_date: dueDates.at(-1) || null, amount_net_cents: documentSign * taxable, vat_cents: documentSign * vat,
        payment_status: "due", recurrence: "none", is_estimate: false, notes: "Importata da XML FatturaPA",
      }).select("id").single();
      if (expenseError || !expense) {
        console.error("Supplier invoice expense creation failed", { file: file.name, code: expenseError?.code, message: expenseError?.message });
        return { ok: false, error: CREDIT_NOTE_TYPES.has(documentType) ? `${file.name}: nota di credito salvata, ma il database non accetta ancora importi negativi. Esegui supplier-credit-notes-migration.sql.` : `${file.name}: fattura salvata, ma movimento spesa non creato.` };
      }
      await supabase.from("supplier_invoices").update({ expense_id: expense.id }).eq("id", invoice.id);

      if (lines.length) await supabase.from("supplier_invoice_lines").insert(lines.map((line, index) => {
        const code = obj(array(line.CodiceArticolo as XmlNode | XmlNode[] | undefined)[0]);
        return { invoice_id: invoice.id, line_number: Number(text(line.NumeroLinea)) || index + 1, code: text(code.CodiceValore) || null, description: text(line.Descrizione) || "Voce fattura", quantity: text(line.Quantita) ? numberValue(line.Quantita) : null, unit: text(line.UnitaMisura) || null, unit_price_cents: text(line.PrezzoUnitario) ? cents(line.PrezzoUnitario) : null, total_cents: cents(line.PrezzoTotale), vat_rate: text(line.AliquotaIVA) ? numberValue(line.AliquotaIVA) : null };
      }));
      if (vatRows.length) await supabase.from("supplier_invoice_vat_summaries").insert(vatRows.map((row) => ({ invoice_id: invoice.id, vat_rate: text(row.AliquotaIVA) ? numberValue(row.AliquotaIVA) : null, taxable_cents: cents(row.ImponibileImporto), vat_cents: cents(row.Imposta), nature: text(row.Natura) || null })));
      if (payments.length) {
        const { error: paymentError } = await supabase.from("supplier_invoice_payments").insert(payments.map((row) => ({ ...row, invoice_id: invoice.id })));
        if (paymentError) {
          console.error("Supplier invoice payment insert failed", { file: file.name, code: paymentError.code, message: paymentError.message });
          const schemaError = paymentError.code === "42P01" || paymentError.code === "42703";
          return { ok: false, error: schemaError ? `${file.name}: fattura salvata, ma struttura dei pagamenti incompleta. Riesegui supplier-invoice-payments-migration.sql.` : `${file.name}: fattura salvata, ma dettagli di pagamento non registrati (codice ${paymentError.code || "sconosciuto"}).` };
        }
      }
      imported++;
    }
  }

  revalidatePath("/admin/spese");
  return { ok: true, message: `Importate ${imported} fatture. ${enriched ? `${enriched} già presenti aggiornate con i dati di pagamento.` : ""}`.trim() };
}

export async function createManualSupplierInvoice(formData: FormData): Promise<InvoiceActionResult> {
  const parsed = manualInvoiceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Controlla i dati obbligatori e gli importi della fattura." };

  const values = parsed.data;
  const { supabase } = await requireAdmin();
  const { data: category } = await supabase.from("expense_categories").select("id").eq("name", "Fatture fornitori").single();
  if (!category) return { ok: false, error: "Esegui supplier-invoices-migration.sql prima di inserire una fattura." };

  const { data: duplicate } = await supabase.from("supplier_invoices").select("id").eq("supplier_vat_number", values.supplier_vat_number).eq("invoice_number", values.invoice_number).eq("issue_date", values.issue_date).maybeSingle();
  if (duplicate) return { ok: false, error: "Questa fattura risulta già presente nell’archivio." };

  const taxable = Math.round(values.taxable_amount * 100);
  const vat = Math.round(taxable * values.vat_rate / 100);
  const total = taxable + vat;
  const sign = CREDIT_NOTE_TYPES.has(values.document_type) ? -1 : 1;
  const paidDate = values.payment_status === "paid" ? new Date().toISOString().slice(0, 10) : null;
  const sourceHash = createHash("sha256").update(["manual", values.supplier_vat_number, values.invoice_number, values.issue_date].join("|")).digest("hex");

  const { data: invoice, error: invoiceError } = await supabase.from("supplier_invoices").insert({
    source_hash: sourceHash,
    source_filename: "Inserimento manuale",
    document_type: values.document_type,
    invoice_number: values.invoice_number,
    issue_date: values.issue_date,
    currency: "EUR",
    supplier_name: values.supplier_name,
    supplier_vat_country: "IT",
    supplier_vat_number: values.supplier_vat_number,
    customer_name: "Il Caffè delle Valli",
    description: values.description,
    taxable_cents: taxable,
    vat_cents: vat,
    total_cents: total,
    due_date: values.due_date,
    payment_status: values.payment_status,
    paid_date: paidDate,
    payment_method: values.payment_method,
  }).select("id").single();
  if (invoiceError || !invoice) {
    console.error("Manual supplier invoice creation failed", { code: invoiceError?.code, message: invoiceError?.message });
    return { ok: false, error: invoiceError?.code === "23505" ? "Questa fattura risulta già presente nell’archivio." : "Impossibile registrare la fattura manuale." };
  }

  const { data: expense, error: expenseError } = await supabase.from("expenses").insert({
    category_id: category.id,
    description: `Fattura ${values.invoice_number} · ${values.supplier_name}`,
    supplier: values.supplier_name,
    invoice_number: values.invoice_number,
    is_invoice: true,
    accounting_label: "F",
    expense_date: values.issue_date,
    due_date: values.due_date,
    paid_date: paidDate,
    amount_net_cents: sign * taxable,
    vat_cents: sign * vat,
    payment_status: values.payment_status === "paid" ? "paid" : "due",
    payment_method: null,
    recurrence: "none",
    is_estimate: false,
    notes: values.description ? `Inserimento manuale · ${values.description}` : "Inserimento manuale",
  }).select("id").single();
  if (expenseError || !expense) {
    await supabase.from("supplier_invoices").delete().eq("id", invoice.id);
    console.error("Manual supplier invoice expense creation failed", { code: expenseError?.code, message: expenseError?.message });
    return { ok: false, error: sign < 0 ? "Impossibile creare il movimento della nota di credito. Esegui supplier-credit-notes-migration.sql." : "Impossibile creare il movimento contabile collegato." };
  }

  await supabase.from("supplier_invoices").update({ expense_id: expense.id }).eq("id", invoice.id);
  await supabase.from("supplier_invoice_lines").insert({ invoice_id: invoice.id, line_number: 1, description: values.description || "Fornitura da fattura inserita manualmente", quantity: 1, unit: null, unit_price_cents: taxable, total_cents: taxable, vat_rate: values.vat_rate });
  await supabase.from("supplier_invoice_vat_summaries").insert({ invoice_id: invoice.id, vat_rate: values.vat_rate, taxable_cents: taxable, vat_cents: vat, nature: null });

  if (values.payment_method || values.due_date) {
    const { error: paymentError } = await supabase.from("supplier_invoice_payments").insert({
      invoice_id: invoice.id,
      payment_group_number: 1,
      installment_number: 1,
      payment_terms: "TP02",
      method_code: values.payment_method,
      due_date: values.due_date,
      amount_cents: sign * total,
    });
    if (paymentError) console.error("Manual supplier invoice payment creation failed", { code: paymentError.code, message: paymentError.message });
  }

  revalidatePath("/admin/spese");
  return { ok: true, message: "Fattura manuale registrata e aggiunta alle spese F." };
}

export async function updateSupplierInvoice(formData: FormData): Promise<InvoiceActionResult> {
  const parsed = z.object({ id: z.coerce.number().int().positive(), due: z.union([z.literal(""), z.iso.date()]).transform((value) => value || null), status: z.enum(["unpaid", "paid"]) }).safeParse({ id: formData.get("id"), due: formData.get("due_date") ?? "", status: formData.get("payment_status") });
  if (!parsed.success) return { ok: false, error: "Controlla scadenza e stato." };
  const { supabase } = await requireAdmin();
  const paidDate = parsed.data.status === "paid" ? new Date().toISOString().slice(0, 10) : null;
  const { data: invoice, error } = await supabase.from("supplier_invoices").update({ due_date: parsed.data.due, payment_status: parsed.data.status, paid_date: paidDate }).eq("id", parsed.data.id).select("expense_id").single();
  if (error) return { ok: false, error: "Impossibile aggiornare la fattura." };
  if (invoice?.expense_id) await supabase.from("expenses").update({ due_date: parsed.data.due, payment_status: parsed.data.status === "paid" ? "paid" : "due", paid_date: paidDate }).eq("id", invoice.expense_id);
  revalidatePath("/admin/spese");
  return { ok: true };
}
