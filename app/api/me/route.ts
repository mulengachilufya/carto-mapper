import { NextResponse } from "next/server";
import { accountsEnabled, getCurrentUser } from "@/lib/supabase/server";
import { getUsage } from "@/lib/quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Who is signed in and how many of today's free maps they have left. */
export async function GET() {
  const accounts = accountsEnabled();
  const user = accounts ? await getCurrentUser() : null;
  return NextResponse.json({
    accounts,
    ai: Boolean(process.env.ANTHROPIC_API_KEY),
    user: user
      ? { email: user.email, firstName: (user.user_metadata?.first_name as string | undefined) ?? null }
      : null,
    usage: user ? await getUsage(user.id) : null,
  });
}
