import { NextResponse } from "next/server";
import { advanceJob, getJob, isLocalJobId, verifyCheckout } from "@/lib/jobs";
import { isPaid, paymentsEnabled, type JobStatus } from "@/lib/workflow";
import { hasSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * The download gate. Answers "may this job be downloaded clean?" — never from a URL
 * flag, always from the database or from Stripe itself:
 *
 *   • payments off (no Stripe keys)  → downloadable, but watermarked
 *   • job paid in the database       → yes
 *   • ?cs=<checkout session> given   → ask Stripe; if it paid for this job, record it
 *                                      (covers the customer landing before the webhook)
 *   • otherwise                      → no; the client may poll while status is "checkout"
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId") ?? "";
  const cs = url.searchParams.get("cs") ?? "";
  if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });

  if (!paymentsEnabled()) {
    return NextResponse.json({ status: "preview", paid: false, payments: "off", watermark: true });
  }

  const job = await getJob(jobId);
  let status: JobStatus = job?.status ?? (isLocalJobId(jobId) || !hasSupabase() ? "preview" : "draft");

  if (!isPaid(status) && cs) {
    const v = await verifyCheckout(cs, jobId);
    if (v.paid) {
      status = "paid";
      await advanceJob(jobId, "paid", {
        stripe_checkout_session_id: cs,
        stripe_payment_intent_id: v.paymentIntent ?? null,
        paid_at: new Date().toISOString(),
        ...(v.email ? { email: v.email } : {}),
      });
    }
  }

  if (!job && !isPaid(status) && !isLocalJobId(jobId) && hasSupabase()) {
    return NextResponse.json({ status: "draft", paid: false, payments: "on", error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json({ status, paid: isPaid(status), payments: "on", watermark: !isPaid(status) });
}

/** The customer downloaded their map: paid → delivered (re-downloads stay allowed). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { jobId?: string; event?: string };
  if (!body.jobId || body.event !== "delivered") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const r = await advanceJob(body.jobId, "delivered", { delivered_at: new Date().toISOString() });
  return NextResponse.json({ ok: r.ok, status: r.status });
}
