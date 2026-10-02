"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, FileUp, ListFilter, ReceiptText, Search, X } from "lucide-react";
import { importSupplierInvoices, updateSupplierInvoice } from "./invoice-actions";

export type SupplierInvoice = {
  id: number;
  source_filename: string;
  document_type: string;
  invoice_number: string;
  issue_date: string;
  currency: string;
  supplier_name: string;
  supplier_vat_country: string | null;
  supplier_vat_number: string;
  supplier_tax_code: string | null;
  supplier_address: string | null;
  customer_name: string;
  customer_vat_number: string | null;
  customer_tax_code: string | null;
  customer_address: string | null;
  description: string | null;
  taxable_cents: number;
  vat_cents: number;
  total_cents: number;
  due_date: string | null;
  payment_status: "unpaid" | "paid";
  paid_date: string | null;
  payment_method: string | null;
  supplier_invoice_lines: {
    id: number;
    line_number: number;
    code: string | null;
    description: string;
    quantity: number | null;
    unit: string | null;
    unit_price_cents: number | null;
    total_cents: number;
    vat_rate: number | null;
  }[];
  supplier_invoice_vat_summaries: {
    id: number;
    vat_rate: number | null;
    taxable_cents: number;
    vat_cents: number;
    nature: string | null;
  }[];
  supplier_invoice_payments: {
    id: number;
    payment_group_number: number;
    installment_number: number;
    payment_terms: string | null;
    method_code: string | null;
    due_date: string | null;
    reference_date: string | null;
    payment_days: number | null;
    amount_cents: number | null;
    beneficiary: string | null;
    bank_name: string | null;
    iban: string | null;
    abi: string | null;
    cab: string | null;
    bic: string | null;
    postal_office_code: string | null;
    payee_first_name: string | null;
    payee_last_name: string | null;
    payee_tax_code: string | null;
    payee_title: string | null;
    payment_code: string | null;
    discount_cents: number | null;
    early_discount_due_date: string | null;
    penalty_cents: number | null;
    penalty_due_date: string | null;
  }[];
};

const euro = (cents: number) => (cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
const date = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString("it-IT");
const monthLabel = (value: string) => new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}-01T12:00:00Z`));
const PAYMENT_METHODS: Record<string, string> = { MP01: "Contanti", MP02: "Assegno", MP03: "Assegno circolare", MP04: "Contanti presso tesoreria", MP05: "Bonifico", MP06: "Vaglia cambiario", MP07: "Bollettino bancario", MP08: "Carta di pagamento", MP09: "RID", MP10: "RID utenze", MP11: "RID veloce", MP12: "RIBA", MP13: "MAV", MP14: "Quietanza erario", MP15: "Giroconto", MP16: "Domiciliazione bancaria", MP17: "Domiciliazione postale", MP18: "Bollettino postale", MP19: "SEPA Direct Debit", MP20: "SEPA Direct Debit CORE", MP21: "SEPA Direct Debit B2B", MP22: "Trattenuta su somme riscosse", MP23: "PagoPA" };
const paymentMethodLabel = (code: string | null) => code ? PAYMENT_METHODS[code] ?? code : "Non indicata";
const paymentTermsLabel = (code: string | null) => code === "TP01" ? "Pagamento a rate" : code === "TP02" ? "Pagamento completo" : code === "TP03" ? "Anticipo" : code ?? "Condizione non indicata";

export function InvoiceManager({ invoices, onBack }: { invoices: SupplierInvoice[]; onBack: () => void }) {
  const router = useRouter();
  const [upload, setUpload] = useState(false);
  const [selected, setSelected] = useState<SupplierInvoice | null>(null);
  const [month, setMonth] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"date_desc" | "date_asc" | "unpaid_first" | "paid_first">("date_desc");
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const filteredInvoices = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("it-IT");
    const normalizedAmount = query.replace(/\s/g, "").replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
    const amount = normalizedAmount ? Number(normalizedAmount) : Number.NaN;

    const matches = invoices.filter((invoice) => {
      if (month !== "all" && !invoice.issue_date.startsWith(month)) return false;
      if (unpaidOnly && invoice.payment_status !== "unpaid") return false;
      const invoiceMethods = invoice.supplier_invoice_payments.map((payment) => payment.method_code).filter(Boolean);
      if (paymentMethod !== "all" && !invoiceMethods.includes(paymentMethod) && invoice.payment_method !== paymentMethod) return false;
      if (!query) return true;
      const supplierMatch = invoice.supplier_name.toLocaleLowerCase("it-IT").includes(query);
      const exactAmountMatch = Number.isFinite(amount) && [invoice.taxable_cents, invoice.total_cents]
        .some((value) => Math.abs(value / 100 - amount) < 0.005);
      const formattedAmountMatch = [invoice.taxable_cents, invoice.total_cents]
        .some((value) => (value / 100).toLocaleString("it-IT", { minimumFractionDigits: 2 }).includes(query));
      return supplierMatch || exactAmountMatch || formattedAmountMatch;
    });

    return matches.sort((a, b) => {
      if (sort === "date_asc") return a.issue_date.localeCompare(b.issue_date) || a.id - b.id;
      if (sort === "unpaid_first") return Number(a.payment_status === "paid") - Number(b.payment_status === "paid") || b.issue_date.localeCompare(a.issue_date);
      if (sort === "paid_first") return Number(b.payment_status === "paid") - Number(a.payment_status === "paid") || b.issue_date.localeCompare(a.issue_date);
      return b.issue_date.localeCompare(a.issue_date) || b.id - a.id;
    });
  }, [invoices, month, search, sort, unpaidOnly, paymentMethod]);

  const availablePaymentMethods = useMemo(() => [...new Set(invoices.flatMap((invoice) => [invoice.payment_method, ...invoice.supplier_invoice_payments.map((payment) => payment.method_code)]).filter((value): value is string => Boolean(value)))].sort((a, b) => paymentMethodLabel(a).localeCompare(paymentMethodLabel(b), "it")), [invoices]);
  const availableMonths = useMemo(() => [...new Set(invoices.map((invoice) => invoice.issue_date.slice(0, 7)))].sort((a, b) => b.localeCompare(a)), [invoices]);

  const pageCount = Math.max(1, Math.ceil(filteredInvoices.length / pageSize));
  const visiblePage = Math.min(page, pageCount);
  const paginatedInvoices = filteredInvoices.slice((visiblePage - 1) * pageSize, visiblePage * pageSize);
  const taxableTotal = filteredInvoices.reduce((sum, invoice) => sum + invoice.taxable_cents, 0);
  const unpaidTotal = filteredInvoices.filter((invoice) => invoice.payment_status === "unpaid").reduce((sum, invoice) => sum + invoice.total_cents, 0);

  const run = (
    action: (data: FormData) => Promise<{ ok: boolean; error?: string; message?: string }>,
    data: FormData,
    done: () => void,
  ) => {
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await action(data);
      if (!result.ok) {
        setError(result.error ?? "Operazione non riuscita.");
        return;
      }
      setMessage(result.message ?? "Fattura aggiornata.");
      done();
      router.refresh();
    });
  };

  return <>
    <section className="invoice-toolbar">
      <div>
        <button type="button" className="invoice-back-link" onClick={onBack}><ArrowLeft size={15} /> Spese</button>
        <p className="admin-kicker">Fatture ricevute</p>
        <h2>Archivio fatture</h2>
        <p>Ogni documento entra nelle spese F nel mese della sua data di emissione.</p>
      </div>
      <button className="admin-action admin-action-primary admin-action-create" onClick={() => setUpload(true)}><FileUp size={17} /> Importa XML</button>
    </section>

    {(error || message) && <div className={`staff-alert ${message ? "invoice-success" : ""}`}>
      <span>{message || error}</span>
      <button onClick={() => { setError(""); setMessage(""); }}><X size={16} /></button>
    </div>}

    <section className="invoice-filters" aria-label="Filtri archivio fatture">
      <label>
        <span>Mese di competenza</span>
        <select value={month} onChange={(event) => { setMonth(event.target.value); setPage(1); }}>
          <option value="all">Tutti i periodi</option>
          {availableMonths.map((value) => <option value={value} key={value}>{monthLabel(value)}</option>)}
        </select>
      </label>
      <label className="invoice-search">
        <span>Cerca per fornitore o importo</span>
        <div><Search size={16} /><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Es. fornitore o 120,00" /></div>
      </label>
      <label>
        <span>Ordina elenco</span>
        <select value={sort} onChange={(event) => { setSort(event.target.value as typeof sort); setPage(1); }}>
          <option value="date_desc">Data · più recenti</option>
          <option value="date_asc">Data · meno recenti</option>
          <option value="unpaid_first">Non pagate prima</option>
          <option value="paid_first">Pagate prima</option>
        </select>
      </label>
      <label>
        <span>Modalità di pagamento</span>
        <select value={paymentMethod} onChange={(event) => { setPaymentMethod(event.target.value); setPage(1); }}>
          <option value="all">Tutte le modalità</option>
          {availablePaymentMethods.map((method) => <option value={method} key={method}>{paymentMethodLabel(method)}</option>)}
        </select>
      </label>
      <button type="button" className={`invoice-unpaid-filter${unpaidOnly ? " active" : ""}`} aria-pressed={unpaidOnly} onClick={() => { setUnpaidOnly((value) => !value); setPage(1); }}>
        <ListFilter size={16}/>
        <span><small>Filtro rapido</small><strong>{unpaidOnly ? "Solo non pagate" : "Mostra non pagate"}</strong></span>
        {unpaidOnly && <Check size={16}/>}
      </button>
    </section>

    <section className="expense-panel invoice-list-panel">
      <div className="invoice-kpis">
        <article><span>Documenti nel risultato</span><strong>{filteredInvoices.length}</strong></article>
        <article><span>Imponibile di competenza</span><strong>{euro(taxableTotal)}</strong></article>
        <article><span>Totale non pagato</span><strong>{euro(unpaidTotal)}</strong></article>
      </div>
      <div className="expense-table-wrap">
        <table className="invoice-table">
          <thead><tr><th>Data</th><th>Fornitore</th><th>Numero</th><th>Imponibile</th><th>Totale</th><th>Pagamento</th><th>Scadenza</th><th>Stato</th></tr></thead>
          <tbody>{paginatedInvoices.map((invoice) => <tr key={invoice.id} onClick={() => setSelected(invoice)}>
            <td>{date(invoice.issue_date)}</td>
            <td><strong>{invoice.supplier_name}</strong><small>P.IVA {invoice.supplier_vat_country}{invoice.supplier_vat_number}</small></td>
            <td>{invoice.invoice_number}</td>
            <td>{euro(invoice.taxable_cents)}</td>
            <td><strong>{euro(invoice.total_cents)}</strong></td>
            <td>{paymentMethodLabel(invoice.supplier_invoice_payments.find((payment) => payment.method_code)?.method_code ?? invoice.payment_method)}</td>
            <td>{invoice.due_date ? date(invoice.due_date) : "Da inserire"}</td>
            <td><span className={`invoice-status ${invoice.payment_status}`}>{invoice.payment_status === "paid" ? "Pagata" : "Non pagata"}</span></td>
          </tr>)}</tbody>
        </table>
        {!filteredInvoices.length && <p className="expense-empty">Nessuna fattura corrisponde ai filtri selezionati.</p>}
      </div>
      <footer className="invoice-pagination">
        <label><span>Righe</span><select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label>
        <span>{filteredInvoices.length ? `${(visiblePage - 1) * pageSize + 1}–${Math.min(visiblePage * pageSize, filteredInvoices.length)} di ${filteredInvoices.length}` : "0 risultati"}</span>
        <div><button type="button" aria-label="Pagina precedente" disabled={visiblePage === 1} onClick={() => setPage(visiblePage - 1)}><ChevronLeft size={17} /></button><strong>Pagina {visiblePage} di {pageCount}</strong><button type="button" aria-label="Pagina successiva" disabled={visiblePage === pageCount} onClick={() => setPage(visiblePage + 1)}><ChevronRight size={17} /></button></div>
      </footer>
    </section>

    {upload && <div className="admin-modal-backdrop"><section className="admin-modal">
      <button className="modal-close" onClick={() => setUpload(false)}><X /></button>
      <span className="invoice-upload-icon"><FileUp /></span>
      <p className="admin-kicker">Importazione FatturaPA</p><h2>Carica file XML</h2>
      <p className="employee-extra-intro">Puoi selezionare fino a 20 file. Allegati PDF e XML originale non vengono archiviati.</p>
      <form onSubmit={(event) => { event.preventDefault(); run(importSupplierInvoices, new FormData(event.currentTarget), () => setUpload(false)); }}>
        <label className="invoice-dropzone"><input name="invoice_files" type="file" accept=".xml,text/xml,application/xml" multiple required /><ReceiptText /><strong>Seleziona le fatture XML</strong><small>Massimo 20 file XML, fino a 8 MB per singolo file</small></label>
        <div className="modal-actions"><button type="button" className="admin-action admin-action-secondary" onClick={() => setUpload(false)}>Annulla</button><button className="admin-action admin-action-primary" disabled={pending}>{pending ? "Importazione…" : "Importa fatture"}</button></div>
      </form>
    </section></div>}

    {selected && <InvoiceDetail invoice={selected} pending={pending} onClose={() => setSelected(null)} onSave={(data) => run(updateSupplierInvoice, data, () => setSelected(null))} />}
  </>;
}

function InvoiceDetail({ invoice, pending, onClose, onSave }: { invoice: SupplierInvoice; pending: boolean; onClose: () => void; onSave: (data: FormData) => void }) {
  return <div className="admin-modal-backdrop invoice-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="admin-modal invoice-document">
      <button className="modal-close" aria-label="Chiudi fattura" onClick={onClose}><X /></button>
      <header>
        <div><span className="invoice-document-mark"><ReceiptText size={18} /></span><p className="admin-kicker">Fattura ricevuta</p><h2>{invoice.supplier_name}</h2><small className="invoice-file-name">{invoice.source_filename}</small></div>
        <div className="invoice-number-block"><small>Fattura numero</small><strong>{invoice.invoice_number}</strong><span>del {date(invoice.issue_date)}</span></div>
      </header>
      <section className="invoice-parties">
        <article><small>Fornitore</small><strong>{invoice.supplier_name}</strong><span>{invoice.supplier_address}</span><span>P.IVA {invoice.supplier_vat_country}{invoice.supplier_vat_number}</span>{invoice.supplier_tax_code && <span>C.F. {invoice.supplier_tax_code}</span>}</article>
        <article><small>Cliente</small><strong>{invoice.customer_name}</strong><span>{invoice.customer_address}</span><span>P.IVA {invoice.customer_vat_number}</span>{invoice.customer_tax_code && <span>C.F. {invoice.customer_tax_code}</span>}</article>
      </section>
      {invoice.description && <p className="invoice-cause"><small>Causale</small>{invoice.description}</p>}
      <div className="expense-table-wrap invoice-lines-wrap"><table><thead><tr><th>Descrizione</th><th>Q.tà</th><th>Prezzo</th><th>IVA</th><th>Totale</th></tr></thead><tbody>{invoice.supplier_invoice_lines.map((line) => <tr key={line.id}><td><strong>{line.description}</strong>{line.code && <small>{line.code}</small>}</td><td>{line.quantity ?? "—"} {line.unit}</td><td>{line.unit_price_cents === null ? "—" : euro(line.unit_price_cents)}</td><td>{line.vat_rate === null ? "—" : `${line.vat_rate}%`}</td><td>{euro(line.total_cents)}</td></tr>)}</tbody></table></div>
      <section className="invoice-payment-details">
        <header><div><p className="admin-kicker">Dati dall’XML</p><h3>Informazioni di pagamento</h3></div><span>{invoice.supplier_invoice_payments.length} {invoice.supplier_invoice_payments.length === 1 ? "pagamento" : "rate"}</span></header>
        {invoice.supplier_invoice_payments.length ? <div className="invoice-payment-grid">{invoice.supplier_invoice_payments.map((payment) => <article key={payment.id}>
          <div className="invoice-payment-heading"><span>{paymentMethodLabel(payment.method_code)}</span><strong>{payment.amount_cents === null ? "Importo non indicato" : euro(payment.amount_cents)}</strong></div>
          <dl>
            <div><dt>Condizioni</dt><dd>{paymentTermsLabel(payment.payment_terms)}</dd></div>
            <div><dt>Scadenza</dt><dd>{payment.due_date ? date(payment.due_date) : "Non indicata"}</dd></div>
            {payment.reference_date && <div><dt>Data riferimento</dt><dd>{date(payment.reference_date)}{payment.payment_days !== null ? ` · ${payment.payment_days} giorni` : ""}</dd></div>}
            {payment.beneficiary && <div><dt>Beneficiario</dt><dd>{payment.beneficiary}</dd></div>}
            {payment.bank_name && <div><dt>Istituto</dt><dd>{payment.bank_name}</dd></div>}
            {payment.iban && <div className="payment-wide"><dt>IBAN</dt><dd>{payment.iban}</dd></div>}
            {(payment.abi || payment.cab || payment.bic) && <div className="payment-wide"><dt>Coordinate</dt><dd>{[payment.abi && `ABI ${payment.abi}`, payment.cab && `CAB ${payment.cab}`, payment.bic && `BIC ${payment.bic}`].filter(Boolean).join(" · ")}</dd></div>}
            {payment.payment_code && <div><dt>Codice pagamento</dt><dd>{payment.payment_code}</dd></div>}
            {(payment.payee_first_name || payment.payee_last_name) && <div><dt>Quietanzante</dt><dd>{[payment.payee_title, payment.payee_first_name, payment.payee_last_name].filter(Boolean).join(" ")}</dd></div>}
            {payment.discount_cents !== null && <div><dt>Sconto anticipato</dt><dd>{euro(payment.discount_cents)}{payment.early_discount_due_date ? ` entro ${date(payment.early_discount_due_date)}` : ""}</dd></div>}
            {payment.penalty_cents !== null && <div><dt>Penale ritardo</dt><dd>{euro(payment.penalty_cents)}{payment.penalty_due_date ? ` dal ${date(payment.penalty_due_date)}` : ""}</dd></div>}
          </dl>
        </article>)}</div> : <p className="invoice-payment-empty">L’XML importato non contiene dettagli di pagamento. Reimporta il file dopo aver eseguito la nuova migrazione.</p>}
      </section>
      <section className="invoice-totals"><span>Imponibile <strong>{euro(invoice.taxable_cents)}</strong></span><span>IVA <strong>{euro(invoice.vat_cents)}</strong></span><span>Totale documento <strong>{euro(invoice.total_cents)}</strong></span></section>
      <form className="invoice-payment" onSubmit={(event) => { event.preventDefault(); onSave(new FormData(event.currentTarget)); }}>
        <input type="hidden" name="id" value={invoice.id} />
        <label className="admin-field"><span>Scadenza pagamento</span><input name="due_date" type="date" defaultValue={invoice.due_date ?? ""} /></label>
        <label className="admin-field"><span>Stato</span><select name="payment_status" defaultValue={invoice.payment_status}><option value="unpaid">Non pagata</option><option value="paid">Pagata</option></select></label>
        <button className="admin-action admin-action-primary invoice-save-status" disabled={pending}><Check size={17} strokeWidth={3} /><span>{pending ? "Salvataggio…" : "Salva stato"}</span></button>
      </form>
    </section>
  </div>;
}
