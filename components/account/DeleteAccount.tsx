"use client";

import { useState } from "react";

/** Delete the account and every saved map, confirmed with the password. */
export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
    if (res?.ok) {
      window.location.assign("/");
      return;
    }
    setBusy(false);
    setError(body?.error ?? "We couldn't delete your account just now. Please try again.");
  }

  return (
    <section className="mt-16 border-t border-atlas-rule pt-8">
      <h2 className="text-lg font-semibold text-atlas-ink">Delete account</h2>
      <p className="mt-1 max-w-xl text-sm text-atlas-ink-2">
        This removes your account and every map saved in it, straight away and for good. It can&apos;t be undone.
      </p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 inline-flex h-10 items-center rounded-full border border-atlas-leather/40 px-5 text-sm font-medium text-atlas-leather hover:bg-atlas-leather/5"
        >
          Delete my account
        </button>
      ) : (
        <form onSubmit={submit} className="mt-4 max-w-sm">
          <label htmlFor="del-pw" className="text-sm font-medium text-atlas-ink">
            Enter your password to confirm
          </label>
          <input
            id="del-pw"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-atlas-rule bg-white px-3 py-2 text-[15px] outline-none focus:border-atlas-leather"
          />
          {error && <p className="mt-2 text-sm text-atlas-leather">{error}</p>}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={busy || !password}
              className="inline-flex h-10 items-center rounded-full bg-atlas-leather px-5 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Deleting…" : "Delete everything"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setPassword("");
                setError(null);
              }}
              className="inline-flex h-10 items-center rounded-full px-5 text-sm text-atlas-ink-2 hover:bg-atlas-card"
            >
              Keep my account
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
