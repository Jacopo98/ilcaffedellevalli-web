import type { Metadata } from "next";
import Image from "next/image";
import { KeyRound, ShieldCheck } from "lucide-react";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = {
  title: "Imposta password | Il Caffè delle Valli",
  robots: { index: false, follow: false },
};

export default function SetPasswordPage() {
  return (
    <main className="admin-shell">
      <div className="login-frame">
        <section className="login-brand-panel">
          <div className="login-beans" aria-hidden="true"><Image src="/coffee-beans.png" alt="" width={1536} height={1024} priority /></div>
          <Image className="login-logo" src="/Logo_black_trasparent.png" alt="Il Caffè delle Valli" width={2843} height={820} priority />
          <p className="login-area-label">Area gestionale</p>
        </section>
        <section className="login-form-panel">
          <div className="login-form-heading"><span className="login-security-icon"><ShieldCheck size={20} /></span><p>Invito verificato</p></div>
          <h1>Benvenuto.</h1>
          <p className="login-intro"><KeyRound size={17} /> Scegli la password personale con cui accederai all’area riservata.</p>
          <PasswordForm />
        </section>
      </div>
    </main>
  );
}
