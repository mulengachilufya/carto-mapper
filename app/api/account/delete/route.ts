import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, anonClient } from "@/lib/auth-server";
import { getCurrentUser } from "@/lib/supabase/server";
import { allow, tooMany } from "@/lib/rate-limit";
import { goodbyeEmail, sendEmail } from "@/lib/email";

export const runtime = "nodejs";

/**
 * Delete the signed-in person's account for good, after they re-enter their password.
 * Their profile and every saved map go with it (on delete cascade in supabase/schema.sql).
 * No one at CartoMapper has to do anything.
 */
export async function POST(req: Request) {
  const admin = adminAuth();
  const anon = anonClient();
  const user = await getCurrentUser();
  if (!admin || !anon) return NextResponse.json({ error: "Accounts aren't switched on yet." }, { status: 503 });
  if (!user?.email) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const { password } = (await req.json().catch(() => ({}))) as { password?: unknown };
  if (typeof password !== "string" || !password) return NextResponse.json({ error: "Enter your password to confirm." }, { status: 400 });
  if (!(await allow(`delete:user:${user.id}`, 5, 60 * 60))) return tooMany();

  const { data: check, error: pwErr } = await anon.auth.signInWithPassword({ email: user.email, password });
  if (pwErr || check.user?.id !== user.id) return NextResponse.json({ error: "That password isn't right." }, { status: 400 });
  await anon.auth.signOut().catch(() => {});

  const firstName = (user.user_metadata?.first_name as string | undefined) ?? null;
  const { error } = await admin.deleteUser(user.id);
  if (error) {
    console.error("[account/delete] deleteUser failed:", error);
    return NextResponse.json({ error: "We couldn't delete your account just now. Please try again." }, { status: 500 });
  }

  // The user no longer exists, so just drop the session cookies.
  const jar = await cookies();
  for (const c of jar.getAll()) if (c.name.startsWith("sb-")) jar.delete(c.name);

  await sendEmail(goodbyeEmail(user.email, firstName)).catch(() => false);
  return NextResponse.json({ ok: true });
}
