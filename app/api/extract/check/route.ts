import { NextResponse } from "next/server";
import { checkPlaces, type Place } from "@/lib/mapspec/extract";
import { accountsEnabled, getCurrentUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Second opinion on places the AI listed from memory: confirm, correct the name, or drop. */
export async function POST(req: Request) {
  if (accountsEnabled() && !(await getCurrentUser())) return NextResponse.json({ error: "signin" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const places = (Array.isArray(body.places) ? (body.places as Place[]) : []).filter((p) => p && typeof p.name === "string").slice(0, 200);
  if (!places.length) return NextResponse.json({ places: [], checks: [] });
  try {
    return NextResponse.json(await checkPlaces(prompt, places));
  } catch (err) {
    console.error("fact-check error:", err);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
