"use client";

import { useActionState } from "react";
import { LockKeyhole, Mail } from "lucide-react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialState);

  return (
    <form action={action} className="admin-form mt-8">
      <label className="admin-field">
        <span>Email</span>
        <div className="admin-input-wrap"><Mail size={17} /><input name="email" type="email" autoComplete="username" required /></div>
      </label>
      <label className="admin-field">
        <span>Password</span>
        <div className="admin-input-wrap"><LockKeyhole size={17} /><input name="password" type="password" autoComplete="current-password" minLength={8} required /></div>
      </label>
      {state.error && <p className="admin-error" role="alert">{state.error}</p>}
      <button className="admin-primary-button" disabled={pending} type="submit">{pending ? "Accesso in corso…" : "Accedi"}</button>
    </form>
  );
}
