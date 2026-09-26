import { NextResponse } from "next/server";
import { getJob } from "@/lib/jobs";
import { isPaid } from "@/lib/workflow";
import { parseMapSpec } from "@/lib/mapspec/schema";
import { getServiceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * The saved map for a job, so a customer can re-download after closing the tab.
 * Only returned to the browser session that made it.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId") ?? "";
  const sessionId = url.searchParams.get("sessionId") ?? "";
  const job = jobId ? await getJob(jobId) : null;
  if (!job || !sessionId || job.session_id !== sessionId) {
    return NextResponse.json({ error: "Map not found" }, { status: 404 });
  }
  const spec = job.map_spec as { title?: string } | null;
  return NextResponse.json({
    spec,
    data: job.uploaded_data?.rows ?? [],
    title: spec?.title ?? "Your map",
    jobId: job.id,
    status: job.status,
  });
}

/**
 * Save the design as the customer last saw it (style, elements, page) before they
 * pay, so the download — even a later re-download — is exactly what they approved.
 * Paid maps are frozen; changing one goes through a revision.
 */
export async function PUT(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { jobId?: string; sessionId?: string; spec?: unknown };
  const job = body.jobId ? await getJob(body.jobId) : null;
  if (!job || !body.sessionId || job.session_id !== body.sessionId || !body.spec) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  if (isPaid(job.status)) return NextResponse.json({ ok: false, reason: "paid maps are frozen" }, { status: 409 });
  const spec = parseMapSpec(body.spec);
  const sb = getServiceSupabase();
  await sb?.from("map_jobs").update({ map_spec: spec, output_options: spec.furniture }).eq("id", job.id);
  return NextResponse.json({ ok: true });
}
