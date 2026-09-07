import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { LoginForm } from "@/app/login/login-form";
import { getCurrentProfile } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Area riservata | Il Caffè delle Valli",
  robots: { index: false, follow: false },
};

export default async function ReservedAreaPage({ searchParams }: { searchParams: Promise<{ auth_error?: string }> }) {
  if (await getCurrentProfile()) redirect("/admin");
  const invitationError = (await searchParams).auth_error === "link_non_valido";
  return (
    <main className="admin-shell">
      <Link className="admin-back-link" href="/"><ArrowLeft size={16} /> Torna al sito</Link>
      <div className="login-frame">
        <section className="login-brand-panel">
          <div className="login-beans" aria-hidden="true"><Image src="/coffee-beans.png" alt="" width={1536} height={1024} priority /></div>
          <Image className="login-logo" src="/Logo_black_trasparent.png" alt="Il Caffè delle Valli" width={2843} height={820} priority />
          <p className="login-area-label">Area gestionale</p>
        </section>
        <section className="login-form-panel">
          <div className="login-form-heading"><span className="login-security-icon"><ShieldCheck size={20} /></span><p>Accesso protetto</p></div>
          <h1>Bentornato.</h1>
          <p className="login-intro">Inserisci le credenziali assegnate per accedere alla dashboard.</p>
          {invitationError && <p className="admin-error" role="alert">Il link di invito non è valido o è scaduto. Chiedi all’amministratore di inviarne uno nuovo.</p>}
          <LoginForm />
          <p className="login-help">Non ricordi le credenziali? Contatta l’amministratore del sito.</p>
        </section>
      </div>
    </main>
  );
}
