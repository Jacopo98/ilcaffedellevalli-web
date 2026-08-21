"use client";

import { Download, Printer } from "lucide-react";

export function ReportActions({ csvUrl }: { csvUrl: string }) {
  return <div className="report-actions"><a href={csvUrl}><Download size={16} /> Scarica CSV</a><button onClick={() => window.print()}><Printer size={16} /> Stampa / salva PDF</button></div>;
}

