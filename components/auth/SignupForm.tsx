"use client";

import { useState } from "react";
import Link from "next/link";
import { browserSupabase } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/safe-redirect";
import { COUNTRIES, ROLES, isValidCountry, isValidRole } from "@/lib/profile-options";
import { AccountsOff, Field, FormMessage, SubmitButton, fieldClass } from "./AuthShell";

export function SignupForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!browserSupabase) return <AccountsOff />;
  const supabase = browserSupabase;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || !lastName.trim()) return setError("Please enter your first name and surname.");
    if (!isValidCountry(country)) return setError("Please choose your country from the list.");
    if (!isValidRole(role)) return setError("Please choose what best describes you.");
    if (password.length < 8) return setError("Your password needs at least 8 characters.");

    setBusy(true);
    const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
    // The account is created confirmed on the server: no email to wait for.
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, country, role, email, password }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
    if (!res?.ok) {
      setBusy(false);
      return setError(json?.error ?? "We couldn't create your account just now. Please try again.");
    }
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err) {
      setBusy(false);
      return setError("Your account is ready, but signing in failed. Please sign in.");
    }
    await fetch("/api/account/welcome", { method: "POST" }).catch(() => {});
    window.location.assign(next);
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name">
          <input className={fieldClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" required />
        </Field>
        <Field label="Surname">
          <input className={fieldClass} value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" required />
        </Field>
      </div>
      <Field label="Country">
        <select className={fieldClass} value={country} onChange={(e) => setCountry(e.target.value)} autoComplete="country-name" required>
          <option value="" disabled>
            Select your country…
          </option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Which best describes you?">
        <select className={fieldClass} value={role} onChange={(e) => setRole(e.target.value)} required>
          <option value="" disabled>
            Select one…
          </option>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Email">
        <input className={fieldClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.org" required />
      </Field>
      <Field label="Password" hint="At least 8 characters.">
        <input className={fieldClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
      </Field>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <SubmitButton busy={busy}>{busy ? "Creating your account…" : "Create free account"}</SubmitButton>
      <p className="text-center text-xs text-atlas-ink-2/80">
        Free forever: up to 10 new maps a day. By signing up you agree to use CartoMapper fairly.{" "}
        <Link href="/how-it-works#faq" className="underline">
          Questions?
        </Link>
      </p>
    </form>
  );
}
