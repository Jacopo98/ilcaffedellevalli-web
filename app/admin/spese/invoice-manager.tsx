"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, FileUp, ReceiptText, Search, X } from "lucide-react";
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
};

const euro = (cents: number) => (cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
const date = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString("it-IT");
const currentMonth = () => new Date().toISOString().slice(0, 7);

export function InvoiceManager({ invoices, onBack }: { invoices: SupplierInvoice[]; onBack: () => void }) {
  const router = useRouter();
  const [upload, setUpload] = useState(false);
  const [selected, setSelected] = useState<SupplierInvoice | null>(null);
  const [month, setMonth] = useState(currentMonth());
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const filteredInvoices = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("it-IT");
    const normalizedAmount = query.replace(/\s/g, "").replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
    const amount = normalizedAmount ? Number(normalizedAmount) : Number.NaN;

    return invoices.filter((invoice) => {
      if (!invoice.issue_date.startsWith(month)) return false;
      if (!query) return true;
      const supplierMatch = invoice.supplier_name.toLocaleLowerCase("it-IT").includes(query);
      const exactAmountMatch = Number.isFinite(amount) && [invoice.taxable_cents, invoice.total_cents]
        .some((value) => Math.abs(value / 100 - amount) < 0.005);
      const formattedAmountMatch = [invoice.taxable_cents, invoice.total_cents]
        .some((value) => (value / 100).toLocaleString("it-IT", { minimumFractionDigits: 2 }).includes(query));
      return supplierMatch || exactAmountMatch || formattedAmountMatch;
    });
  }, [invoices, month, search]);

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
        <input type="month" value={month} onChange={(event) => { setMonth(event.target.value); setPage(1); }} />
      </label>
      <label className="invoice-search">
        <span>Cerca per fornitore o importo</span>
        <div><Search size={16} /><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Es. fornitore o 120,00" /></div>
      </label>
    </section>

    <section className="expense-panel invoice-list-panel">
      <div className="invoice-kpis">
        <article><span>Documenti nel risultato</span><strong>{filteredInvoices.length}</strong></article>
        <article><span>Imponibile di competenza</span><strong>{euro(taxableTotal)}</strong></article>
        <article><span>Totale non pagato</span><strong>{euro(unpaidTotal)}</strong></article>
      </div>
      <div className="expense-table-wrap">
        <table className="invoice-table">
          <thead><tr><th>Data</th><th>Fornitore</th><th>Numero</th><th>Imponibile</th><th>Totale</th><th>Scadenza</th><th>Stato</th></tr></thead>
          <tbody>{paginatedInvoices.map((invoice) => <tr key={invoice.id} onClick={() => setSelected(invoice)}>
            <td>{date(invoice.issue_date)}</td>
            <td><strong>{invoice.supplier_name}</strong><small>P.IVA {invoice.supplier_vat_country}{invoice.supplier_vat_number}</small></td>
            <td>{invoice.invoice_number}</td>
            <td>{euro(invoice.taxable_cents)}</td>
            <td><strong>{euro(invoice.total_cents)}</strong></td>
            <td>{invoice.due_date ? date(invoice.due_date) : "Da inserire"}</td>
            <td><span className={`invoice-status ${invoice.payment_status}`}>{invoice.payment_status === "paid" ? "Pagata" : "Non pagata"}</span></td>
          </tr>)}</tbody>
        </table>
        {!filteredInvoices.length && <p className="expense-empty">Nessuna fattura trovata nel mese selezionato.</p>}
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
        <label className="invoice-dropzone"><input name="invoice_files" type="file" accept=".xml,text/xml,application/xml" multiple required /><ReceiptText /><strong>Seleziona le fatture XML</strong><small>Massimo 8 MB per file, 10 MB complessivi</small></label>
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
