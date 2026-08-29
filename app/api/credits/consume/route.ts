import { NextResponse } from "next/server";
import { consumeCredit } from "@/lib/credits";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { sessionId?: string; jobId?: string };
  if (!body.sessionId || !body.jobId) {
    return NextResponse.json({ error: "sessionId and jobId are required" }, { status: 400 });
  }
  const ok = await consumeCredit(body.sessionId, body.jobId);
  if (!ok) {
    return NextResponse.json({ error: "No credits available" }, { status: 402 });
  }
  return NextResponse.json({ ok: true });
}
