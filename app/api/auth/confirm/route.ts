import { NextResponse } from "next/server";
import { adminAuth, anonClient, errCode, normEmail } from "@/lib/auth-server";

export const runtime = "nodejs";

/**
 * For accounts made while email confirmation was on and never confirmed: if the
 * password is right, confirm the account now so the person can simply sign in.
 * Supabase only reports "email not confirmed" after the password has checked out,
 * so a wrong password can never confirm anything.
 */
export async function POST(req: Request) {
  const admin = adminAuth();
  const anon = anonClient();
  if (!admin || !anon) return NextResponse.json({ ok: false }, { status: 503 });
  const b = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = normEmail(b.email);
  if (!email || typeof b.password !== "string") return NextResponse.json({ ok: false }, { status: 400 });

  const { error } = await anon.auth.signInWithPassword({ email, password: b.password });
  if (!error) return NextResponse.json({ ok: true });
  if (errCode(error) !== "email_not_confirmed") return NextResponse.json({ ok: false }, { status: 401 });

  // The account exists (the password matched); look it up without sending anything.
  const { data, error: linkErr } = await admin.generateLink({ type: "magiclink", email });
  const id = data?.user?.id;
  if (linkErr || !id) return NextResponse.json({ ok: false }, { status: 500 });
  const { error: updErr } = await admin.updateUserById(id, { email_confirm: true });
  return NextResponse.json({ ok: !updErr }, { status: updErr ? 500 : 200 });
}
