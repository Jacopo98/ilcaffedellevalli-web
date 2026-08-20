"use client";

import { useFormStatus } from "react-dom";

export function AdminSubmitButton({ children, variant = "primary", confirmMessage }: { children: React.ReactNode; variant?: "primary" | "secondary" | "danger"; confirmMessage?: string }) {
  const { pending } = useFormStatus();
  return <button className={`admin-action admin-action-${variant}`} disabled={pending} type="submit" onClick={(event) => { if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault(); }}>{pending ? "Salvataggio…" : children}</button>;
}
