"use client";

import { useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { AccountsOff, Field, FormMessage, SubmitButton, fieldClass } from "./AuthShell";

/**
 * Forgot password, in two steps on one page: email → a 6-digit code arrives from
 * CartoMapper → code + new password → signed in. (If the site has no email service
 * yet, Supabase sends a reset link instead.)
 */
export function ForgotForm() {
  const [step, setStep] = useState<"email" | "code" | "link">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!browserSupabase) return <AccountsOff />;
  const supabase = browserSupabase;

  async function requestCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    const res = await fetch("/api/auth/reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => ({}))) as { error?: string; fallback?: boolean } | undefined;
    if (!res?.ok) {
      setBusy(false);
      return setError(json?.error ?? "Something went wrong. Please try again.");
    }
    if (json?.fallback) {
      await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` });
      setBusy(false);
      return setStep("link");
    }
    setBusy(false);
    setStep("code");
    if (e === undefined) setInfo("A new code is on its way.");
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Your new password needs at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    const res = await fetch("/api/auth/reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, password }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
    if (!res?.ok) {
      setBusy(false);
      return setError(json?.error ?? "Something went wrong. Please try again.");
    }
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err) {
      setBusy(false);
      return setError("Your password was changed. Please sign in with it.");
    }
    window.location.assign("/create");
  }

  if (step === "link") {
    return (
      <FormMessage tone="ok">
        If <strong>{email.trim()}</strong> has an account, a reset link is on its way. Open it in this browser.
      </FormMessage>
    );
  }

  if (step === "code") {
    return (
      <form onSubmit={reset} className="space-y-4" noValidate>
        <FormMessage tone="ok">
          If <strong>{email.trim()}</strong> has an account, we&apos;ve emailed it a 6-digit code. It expires in an hour.
        </FormMessage>
        <Field label="Code from the email">
          <input
            className={`${fieldClass} tabular-nums text-lg tracking-[0.4em]`}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            required
          />
        </Field>
        <Field label="New password" hint="At least 8 characters.">
          <input className={fieldClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
        </Field>
        <Field label="Confirm new password">
          <input className={fieldClass} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
        </Field>
        {error && <FormMessage tone="error">{error}</FormMessage>}
        {info && <FormMessage tone="ok">{info}</FormMessage>}
        <SubmitButton busy={busy}>{busy ? "Saving…" : "Save password and sign in"}</SubmitButton>
        <p className="text-center text-sm text-atlas-ink-2">
          No email?{" "}
          <button type="button" className="text-atlas-moss underline" onClick={() => requestCode()} disabled={busy}>
            Send a new code
          </button>
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={requestCode} className="space-y-4" noValidate>
      <Field label="Email">
        <input className={fieldClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </Field>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <SubmitButton busy={busy}>{busy ? "Sending…" : "Email me a code"}</SubmitButton>
    </form>
  );
}
