"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { browserSupabase } from "@/lib/supabase/client";
import { AccountsOff, Field, FormMessage, SubmitButton, fieldClass } from "./AuthShell";

/** Reached from the reset email via /auth/callback, which has already signed the user in. */
export function ResetForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    browserSupabase?.auth.getUser().then(({ data }) => setHasSession(Boolean(data.user)));
  }, []);

  if (!browserSupabase) return <AccountsOff />;
  const supabase = browserSupabase;

  if (hasSession === false) {
    return (
      <FormMessage tone="error">
        This reset link has expired or was already used.{" "}
        <Link href="/forgot-password" className="font-medium underline">
          Ask for a new one
        </Link>
        .
      </FormMessage>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Your new password needs at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setBusy(false);
      return setError(err.message);
    }
    window.location.assign("/create");
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="New password" hint="At least 8 characters.">
        <input className={fieldClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
      </Field>
      <Field label="Confirm new password">
        <input className={fieldClass} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
      </Field>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <SubmitButton busy={busy || hasSession === null}>{busy ? "Saving…" : "Save password and continue"}</SubmitButton>
    </form>
  );
}
