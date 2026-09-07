"use client";

import { useActionState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { changePassword, type ProfileActionState } from "./actions";

const initialState: ProfileActionState = {};

export function PasswordSettingsForm() {
  const [state, action, pending] = useActionState(changePassword, initialState);
  return (
    <form action={action} className="profile-security-form">
      <div className="profile-security-heading"><span><ShieldCheck /></span><div><p className="admin-kicker">Sicurezza account</p><h2>Cambia password</h2><p>Conferma la password attuale e scegline una nuova.</p></div></div>
      <div className="admin-edit-grid">
        <label className="admin-field admin-field-wide"><span>Password attuale</span><div className="admin-input-wrap"><LockKeyhole size={17} /><input name="current_password" type="password" autoComplete="current-password" required /></div></label>
        <label className="admin-field"><span>Nuova password</span><div className="admin-input-wrap"><LockKeyhole size={17} /><input name="new_password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></div></label>
        <label className="admin-field"><span>Conferma password</span><div className="admin-input-wrap"><LockKeyhole size={17} /><input name="confirmation" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></div></label>
      </div>
      <p className="profile-password-hint">Usa almeno 12 caratteri e una password che non utilizzi per altri servizi.</p>
      {state.error && <p className="admin-error" role="alert">{state.error}</p>}
      {state.ok && <p className="profile-success" role="status">Password aggiornata correttamente.</p>}
      <div className="modal-actions"><button className="admin-action admin-action-primary" disabled={pending} type="submit">{pending ? "Aggiornamento…" : "Aggiorna password"}</button></div>
    </form>
  );
}
