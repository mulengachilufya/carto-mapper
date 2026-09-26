import { NextResponse } from "next/server";
import { accountsEnabled, createServerSupabase } from "@/lib/supabase/server";

/** POST-only, so a link or prefetch can't sign someone out. */
export async function POST(req: Request) {
  if (accountsEnabled()) {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
