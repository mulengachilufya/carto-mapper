"use client";

import { useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { AccountsOff, Field, FormMessage, SubmitButton, fieldClass } from "./AuthShell";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!browserSupabase) return <AccountsOff />;
  const supabase = browserSupabase;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setBusy(false);
    // Same answer whether or not the email has an account, so this can't be used to probe.
    if (err && !/not found/i.test(err.message)) setError(err.message);
    else setSent(true);
  }

  if (sent) {
    return (
      <FormMessage tone="ok">
        If <strong>{email.trim()}</strong> has an account, a link to choose a new password is on its way. It works once,
        for an hour.
      </FormMessage>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Email">
        <input className={fieldClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </Field>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <SubmitButton busy={busy}>{busy ? "Sending…" : "Send reset link"}</SubmitButton>
    </form>
  );
}
