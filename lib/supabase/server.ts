import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

let cached: SupabaseClient | null = null;

/**
 * Server-side Supabase client using the service-role key (bypasses RLS).
 * Returns null when env vars are absent.
 */
export function getServiceSupabase(): SupabaseClient | null {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/**
 * Accounts are on when Supabase is fully configured: the anon key signs people in,
 * the service key saves their maps and counts them against the daily limit. Without
 * it (local development) the site runs open — no sign-in, no saving, no limit.
 */
export function accountsEnabled(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/** Cookie-backed Supabase client for route handlers and server components. */
export async function createServerSupabase(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server components can't set cookies; the proxy refreshes the session instead.
        }
      },
    },
  });
}

/**
 * The signed-in user, verified with Supabase Auth (getUser, not getSession — a
 * cookie's JWT is never trusted without checking it). Null when signed out or
 * when accounts are off.
 */
export async function getCurrentUser(): Promise<User | null> {
  if (!accountsEnabled()) return null;
  try {
    const sb = await createServerSupabase();
    const { data } = await sb.auth.getUser();
    return data.user ?? null;
  } catch {
    return null;
  }
}
