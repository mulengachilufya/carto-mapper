import { NextResponse } from "next/server";
import { paymentsEnabled } from "@/lib/workflow";

export const runtime = "nodejs";

/** What this deployment can do — so the UI never offers a flow the server can't finish. */
export async function GET() {
  return NextResponse.json({
    payments: paymentsEnabled(),
    ai: Boolean(process.env.ANTHROPIC_API_KEY),
    persistence: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
}
