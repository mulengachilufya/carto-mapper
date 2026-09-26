import { NextResponse } from "next/server";
import { getOwnJob } from "@/lib/jobs";
import { parseMapSpec } from "@/lib/mapspec/schema";
import { getCurrentUser, getServiceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** One of the signed-in user's saved maps, to view and download again. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  const jobId = new URL(req.url).searchParams.get("jobId") ?? "";
  const job = user ? await getOwnJob(jobId, user.id) : null;
  if (!job) return NextResponse.json({ error: "Map not found" }, { status: 404 });
  const spec = job.map_spec as { title?: string } | null;
  return NextResponse.json({
    spec,
    data: job.uploaded_data?.rows ?? [],
    title: spec?.title ?? "Your map",
    jobId: job.id,
  });
}

/**
 * Save the design exactly as the user last saw it (style, elements, page), so the
 * copy in their account matches what they downloaded. No AI involved, so no limit.
 */
export async function PUT(req: Request) {
  const user = await getCurrentUser();
  const body = (await req.json().catch(() => ({}))) as { jobId?: string; spec?: unknown };
  const job = user && body.jobId ? await getOwnJob(body.jobId, user.id) : null;
  if (!job || !body.spec) return NextResponse.json({ ok: false }, { status: 404 });
  const spec = parseMapSpec(body.spec);
  await getServiceSupabase()
    ?.from("map_jobs")
    .update({ map_spec: spec, output_options: spec.furniture, delivered_at: new Date().toISOString() })
    .eq("id", job.id)
    .eq("user_id", user!.id);
  return NextResponse.json({ ok: true });
}

/**
 * Remove one of the user's maps from their account. A soft delete: the row still
 * counts toward today's limit, so deleting can't be used to make more maps.
 */
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  const jobId = new URL(req.url).searchParams.get("jobId") ?? "";
  const job = user ? await getOwnJob(jobId, user.id) : null;
  if (!job) return NextResponse.json({ ok: false }, { status: 404 });
  await getServiceSupabase()
    ?.from("map_jobs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", job.id)
    .eq("user_id", user!.id);
  return NextResponse.json({ ok: true });
}
