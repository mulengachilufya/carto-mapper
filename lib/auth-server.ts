import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServiceSupabase } from "@/lib/supabase/server";

/**
 * Account plumbing that runs on the server, so sign-up and recovery never depend on
 * Supabase's own emails or dashboard redirect settings:
 *  • accounts are created already confirmed (no "check your email" step);
 *  • recovery codes are generated here and emailed from CartoMapper.
 */

/** Admin auth API (service role). Null when accounts aren't configured. */
export function adminAuth() {
  return getServiceSupabase()?.auth.admin ?? null;
}

/** A throwaway anon client for checks that must not touch anyone's cookies. */
export function anonClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const normEmail = (e: unknown) => String(e ?? "").trim().toLowerCase();
export const validPassword = (p: unknown): p is string => typeof p === "string" && p.length >= 8 && p.length <= 72;

/** Supabase errors carry a stable `code`; older servers only a message. */
export function errCode(e: unknown): string {
  const x = e as { code?: string; message?: string } | null;
  if (x?.code) return x.code;
  const m = (x?.message ?? "").toLowerCase();
  if (m.includes("not confirmed")) return "email_not_confirmed";
  if (m.includes("already") && (m.includes("registered") || m.includes("exists"))) return "email_exists";
  if (m.includes("invalid login")) return "invalid_credentials";
  return "unknown";
}
