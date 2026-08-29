import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const jobId = new URL(req.url).searchParams.get("jobId") ?? "";
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const sb = getServiceSupabase();
  if (!sb) {
    // Supabase isn't configured — local/dev mode with no persistence to check
    // against. Don't block the flow; there's nothing to gate.
    return NextResponse.json({ paid: true, mode: "dev" });
  }

  const { data, error } = await sb.from("map_jobs").select("status").eq("id", jobId).single();
  if (error || !data) {
    return NextResponse.json({ paid: false, error: "Job not found" }, { status: 404 });
  }

  const paid = data.status === "paid" || data.status === "complete";
  return NextResponse.json({ paid });
}
