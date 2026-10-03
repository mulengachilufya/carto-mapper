"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { browserSupabase } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/safe-redirect";
import { AccountsOff, Field, FormMessage, SubmitButton, fieldClass } from "./AuthShell";

const LINK_ERRORS: Record<string, string> = {
  expired_link: "That link has expired or was already used. Just sign in below.",
  missing_code: "That link was incomplete. Just sign in below.",
};

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the URL on mount
    if (code && LINK_ERRORS[code]) setError(LINK_ERRORS[code]);
  }, []);

  if (!browserSupabase) return <AccountsOff />;
  const supabase = browserSupabase;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const creds = { email: email.trim(), password };
    let { error: err } = await supabase.auth.signInWithPassword(creds);
    // Accounts made while email confirmation was on: confirm on the right password, then sign in.
    if (err && /not confirmed/i.test(err.message)) {
      const ok = await fetch("/api/auth/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creds),
      })
        .then((r) => r.ok)
        .catch(() => false);
      if (ok) ({ error: err } = await supabase.auth.signInWithPassword(creds));
    }
    if (err) {
      setBusy(false);
      return setError(/invalid login|invalid credentials/i.test(err.message) ? "That email and password don't match an account." : err.message);
    }
    window.location.assign(safeNextPath(new URLSearchParams(window.location.search).get("next")));
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Email">
        <input className={fieldClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </Field>
      <Field label="Password">
        <input className={fieldClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </Field>
      <div className="-mt-1 text-right text-sm">
        <Link href="/forgot-password" className="text-atlas-moss hover:underline">
          Forgot your password?
        </Link>
      </div>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <SubmitButton busy={busy}>{busy ? "Signing in…" : "Sign in"}</SubmitButton>
    </form>
  );
}
