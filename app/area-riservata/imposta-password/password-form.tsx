"use client";

import { useActionState } from "react";
import { LockKeyhole } from "lucide-react";
import { setInitialPassword, type PasswordState } from "./actions";

const initialState: PasswordState = {};

export function PasswordForm() {
  const [state, action, pending] = useActionState(setInitialPassword, initialState);
  return (
    <form action={action} className="admin-form mt-8">
      <label className="admin-field"><span>Nuova password</span><div className="admin-input-wrap"><LockKeyhole size={17} /><input name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></div></label>
      <label className="admin-field"><span>Conferma password</span><div className="admin-input-wrap"><LockKeyhole size={17} /><input name="confirmation" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></div></label>
      <p className="login-help">Usa almeno 12 caratteri e una password diversa da quelle utilizzate altrove.</p>
      {state.error && <p className="admin-error" role="alert">{state.error}</p>}
      <button className="admin-primary-button" disabled={pending} type="submit">{pending ? "Impostazione in corso…" : "Imposta password e accedi"}</button>
    </form>
  );
}
