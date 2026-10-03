import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { sendWelcomeIfNew } from "@/lib/email";

export const runtime = "nodejs";

/** Called by the sign-up form once the account exists. Sends at most one welcome email. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "signin" }, { status: 401 });
  const sent = await sendWelcomeIfNew(user);
  return NextResponse.json({ ok: true, sent });
}
