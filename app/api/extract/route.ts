import { NextResponse } from "next/server";
import { extractMapData, type ContextFile } from "@/lib/mapspec/extract";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const files = Array.isArray(body.files)
    ? (body.files as ContextFile[]).filter((f) => f && typeof f.dataBase64 === "string").slice(0, 6)
    : [];

  try {
    const result = await extractMapData(prompt, files);
    return NextResponse.json(result);
  } catch (err) {
    console.error("extract error:", err);
    // Degrade gracefully — the flow continues with whatever the user provided.
    return NextResponse.json({ table: null, roles: null });
  }
}
