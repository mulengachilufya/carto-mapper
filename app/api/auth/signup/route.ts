import { NextResponse } from "next/server";
import { accountsEnabled } from "@/lib/supabase/server";
import { adminAuth, EMAIL_RE, errCode, normEmail, validPassword } from "@/lib/auth-server";
import { isValidCountry, isValidRole } from "@/lib/profile-options";
import { allow, clientIp, tooMany } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Create an account, confirmed on the spot: no confirmation email, no link to click.
 * The browser signs in straight after with the same email and password.
 */
export async function POST(req: Request) {
  const admin = adminAuth();
  if (!accountsEnabled() || !admin) return NextResponse.json({ error: "Accounts aren't switched on yet." }, { status: 503 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const firstName = String(b.firstName ?? "").trim().slice(0, 120);
  const lastName = String(b.lastName ?? "").trim().slice(0, 120);
  const email = normEmail(b.email);
  if (!firstName || !lastName) return bad("Please enter your first name and surname.");
  if (!isValidCountry(b.country)) return bad("Please choose your country from the list.");
  if (!isValidRole(b.role)) return bad("Please choose what best describes you.");
  if (!EMAIL_RE.test(email)) return bad("Please enter a valid email address.");
  if (!validPassword(b.password)) return bad("Your password needs 8 to 72 characters.");
  // Throwaway accounts are the cheapest way to get more free maps: cap them per network and per address.
  if (!(await allow(`signup:ip:${clientIp(req)}`, 5, 60 * 60))) return tooMany("new accounts from this network");
  if (!(await allow(`signup:email:${email}`, 3, 24 * 60 * 60))) return tooMany("sign-ups for this email today");

  const { error } = await admin.createUser({
    email,
    password: b.password,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName, full_name: `${firstName} ${lastName}`, country: b.country, role: b.role },
  });
  if (error) {
    const code = errCode(error);
    if (code === "email_exists" || code === "user_already_exists")
      return NextResponse.json({ error: "That email already has an account. Sign in instead.", code: "exists" }, { status: 409 });
    if (code === "weak_password") return bad("Please choose a stronger password.");
    console.error("[signup] createUser failed:", error);
    return NextResponse.json({ error: "We couldn't create your account just now. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });
