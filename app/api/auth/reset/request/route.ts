import { NextResponse } from "next/server";
import { adminAuth, EMAIL_RE, normEmail } from "@/lib/auth-server";
import { resetCodeEmail, sendEmail } from "@/lib/email";

export const runtime = "nodejs";

/**
 * Email a 6-digit recovery code, from CartoMapper. The answer is the same whether
 * or not the address has an account, so this can't be used to find out who's signed up.
 * Without an email service configured, the browser falls back to Supabase's reset link.
 */
export async function POST(req: Request) {
  const admin = adminAuth();
  if (!admin) return NextResponse.json({ error: "Accounts aren't switched on yet." }, { status: 503 });
  const { email: raw } = (await req.json().catch(() => ({}))) as { email?: string };
  const email = normEmail(raw);
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ ok: true, fallback: true });

  const { data, error } = await admin.generateLink({ type: "recovery", email });
  const code = data?.properties?.email_otp;
  if (!error && code) {
    const name = (data.user?.user_metadata?.first_name as string | undefined) ?? null;
    const sent = await sendEmail(resetCodeEmail(email, code, name));
    if (!sent) return NextResponse.json({ error: "We couldn't send the email just now. Please try again." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
