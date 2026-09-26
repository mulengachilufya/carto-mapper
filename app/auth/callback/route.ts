import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { accountsEnabled, createServerSupabase } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";

/**
 * Landing page for links in Supabase emails (confirm sign-up, reset password).
 * Handles both link styles Supabase can send — `?code=` (PKCE) and
 * `?token_hash=&type=` — signs the user in, then sends them on to `next`.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const next = safeNextPath(url.searchParams.get("next"), "/create");
  if (!accountsEnabled()) return NextResponse.redirect(new URL("/", url.origin));

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const supabase = await createServerSupabase();

  let error: unknown = null;
  if (code) ({ error } = await supabase.auth.exchangeCodeForSession(code));
  else if (tokenHash && type) ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  else return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));

  if (error) {
    console.error("[auth/callback] sign-in from email link failed:", error);
    return NextResponse.redirect(new URL("/login?error=expired_link", url.origin));
  }
  return NextResponse.redirect(new URL(type === "recovery" ? "/reset-password" : next, url.origin));
}
