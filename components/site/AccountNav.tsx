"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { browserSupabase } from "@/lib/supabase/client";

type Who = { initials: string; email: string } | null;

/** Header controls: "Sign in" when signed out, "My maps" when signed in. */
export function AccountNav() {
  // undefined = not known yet (render nothing, to avoid a flash of the wrong state)
  const [who, setWho] = useState<Who | undefined>(browserSupabase ? undefined : null);

  useEffect(() => {
    if (!browserSupabase) return;
    const toWho = (u: { email?: string; user_metadata?: Record<string, unknown> } | null | undefined): Who => {
      if (!u) return null;
      const f = String(u.user_metadata?.first_name ?? u.email ?? "?");
      const l = String(u.user_metadata?.last_name ?? "");
      return { initials: (f[0] + (l[0] ?? "")).toUpperCase(), email: u.email ?? "" };
    };
    browserSupabase.auth.getSession().then(({ data }) => setWho(toWho(data.session?.user)));
    const { data } = browserSupabase.auth.onAuthStateChange((_e, session) => setWho(toWho(session?.user)));
    return () => data.subscription.unsubscribe();
  }, []);

  const cta = (
    <Link
      href="/create"
      className="inline-flex h-10 items-center rounded-full bg-atlas-deep px-5 text-sm font-medium text-atlas-paper transition-colors hover:bg-atlas-ocean"
    >
      Make a map
    </Link>
  );

  if (who === undefined) return <div className="flex items-center gap-3">{cta}</div>;
  if (!browserSupabase) return cta;

  return (
    <div className="flex items-center gap-3">
      {who ? (
        <Link href="/account" title={who.email} className="flex items-center gap-2 text-sm text-atlas-ink-2 hover:text-atlas-ocean">
          <span className="hidden sm:inline">My maps</span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-atlas-rule bg-atlas-card font-mono text-xs font-semibold text-atlas-ink">
            {who.initials}
          </span>
        </Link>
      ) : (
        <Link href="/login" className="text-sm text-atlas-ink-2 transition-colors hover:text-atlas-ocean">
          Sign in
        </Link>
      )}
      {cta}
    </div>
  );
}
