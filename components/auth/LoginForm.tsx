"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { browserSupabase } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/safe-redirect";
import { AccountsOff, Field, FormMessage, SubmitButton, fieldClass } from "./AuthShell";

const LINK_ERRORS: Record<string, string> = {
  expired_link: "That link has expired or was already used. Sign in, or ask for a new one.",
  missing_code: "That link was incomplete. Sign in, or ask for a new one.",
};

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);

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
    setInfo(null);
    setUnconfirmed(false);
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err) {
      setBusy(false);
      if (/not confirmed/i.test(err.message)) {
        setUnconfirmed(true);
        return setError("Please confirm your email first — the link is in your inbox.");
      }
      return setError(/invalid login/i.test(err.message) ? "That email and password don't match an account." : err.message);
    }
    window.location.assign(safeNextPath(new URLSearchParams(window.location.search).get("next")));
  }

  async function resend() {
    const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
    const { error: err } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (err) setError(err.message);
    else {
      setError(null);
      setInfo(`A new confirmation link is on its way to ${email.trim()}.`);
    }
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
        <Link href="/forgot-password" className="text-atlas-ocean hover:underline">
          Forgot your password?
        </Link>
      </div>
      {error && (
        <FormMessage tone="error">
          {error}{" "}
          {unconfirmed && email && (
            <button type="button" onClick={resend} className="font-medium underline">
              Send it again
            </button>
          )}
        </FormMessage>
      )}
      {info && <FormMessage tone="ok">{info}</FormMessage>}
      <SubmitButton busy={busy}>{busy ? "Signing in…" : "Sign in"}</SubmitButton>
    </form>
  );
}
