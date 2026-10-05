import { NextResponse } from "next/server";
import { adminAuth, anonClient, EMAIL_RE, normEmail, validPassword } from "@/lib/auth-server";
import { allow, clientIp, tooMany } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Check the emailed code and set the new password. The browser then signs in with it. */
export async function POST(req: Request) {
  const admin = adminAuth();
  const anon = anonClient();
  if (!admin || !anon) return NextResponse.json({ error: "Accounts aren't switched on yet." }, { status: 503 });
  const b = (await req.json().catch(() => ({}))) as { email?: string; code?: string; password?: string };
  const email = normEmail(b.email);
  const code = String(b.code ?? "").replace(/\s+/g, "");
  if (!EMAIL_RE.test(email) || !/^\d{6,10}$/.test(code)) return NextResponse.json({ error: "Enter the code from the email." }, { status: 400 });
  if (!validPassword(b.password)) return NextResponse.json({ error: "Your new password needs 8 to 72 characters." }, { status: 400 });

  // A 6-digit code can't be guessed in 10 tries an hour.
  if (!(await allow(`reset-code:email:${email}`, 10, 60 * 60))) return tooMany("tries with this email");
  if (!(await allow(`reset-code:ip:${clientIp(req)}`, 30, 60 * 60))) return tooMany("tries");
  const { data, error } = await anon.auth.verifyOtp({ email, token: code, type: "recovery" });
  const id = data?.user?.id;
  if (error || !id) return NextResponse.json({ error: "That code is wrong or has expired. Ask for a new one." }, { status: 400 });
  // A reset also proves the address belongs to them, so confirm it if it wasn't.
  const { error: updErr } = await admin.updateUserById(id, { password: b.password, email_confirm: true });
  if (updErr) {
    console.error("[reset] password update failed:", updErr);
    return NextResponse.json({ error: "We couldn't save the new password. Please try again." }, { status: 500 });
  }
  await anon.auth.signOut().catch(() => {});
  return NextResponse.json({ ok: true });
}
