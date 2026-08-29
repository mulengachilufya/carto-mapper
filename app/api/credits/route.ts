import { NextResponse } from "next/server";
import { getRemainingCredits } from "@/lib/credits";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get("sessionId") ?? "";
  if (!sessionId) return NextResponse.json({ remaining: 0 });
  const remaining = await getRemainingCredits(sessionId);
  return NextResponse.json({ remaining });
}
