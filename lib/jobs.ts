import Stripe from "stripe";
import { getServiceSupabase } from "@/lib/supabase/server";
import { canTransition, isPaid, normalizeStatus, type JobStatus } from "@/lib/workflow";

export interface JobRow {
  id: string;
  status: JobStatus;
  session_id: string;
  map_spec: unknown;
  uploaded_data: { columns: string[]; rows: Record<string, unknown>[] } | null;
  paid_revisions_used: number;
}

/** Jobs made without a database (Stripe-only or local setups) carry a client id. */
export const isLocalJobId = (id: string) => id.startsWith("local-");

export async function getJob(jobId: string): Promise<JobRow | null> {
  const sb = getServiceSupabase();
  if (!sb || !jobId || isLocalJobId(jobId)) return null;
  const { data, error } = await sb
    .from("map_jobs")
    .select("id, status, session_id, map_spec, uploaded_data, paid_revisions_used")
    .eq("id", jobId)
    .maybeSingle();
  if (error || !data) return null;
  return { ...data, status: normalizeStatus(data.status), paid_revisions_used: data.paid_revisions_used ?? 0 } as JobRow;
}

/**
 * Move a job to `to` if the state machine allows it from its current status. The
 * update only applies while the status is still what we read, so concurrent
 * webhooks, redirects and credit spends can't overwrite each other.
 */
export async function advanceJob(
  jobId: string,
  to: JobStatus,
  extra: Record<string, unknown> = {},
): Promise<{ ok: boolean; status: JobStatus | null }> {
  const sb = getServiceSupabase();
  if (!sb || !jobId || isLocalJobId(jobId)) return { ok: false, status: null };
  const { data: row } = await sb.from("map_jobs").select("status").eq("id", jobId).maybeSingle();
  if (!row) return { ok: false, status: null };
  const from = normalizeStatus(row.status);
  if (from === to && Object.keys(extra).length === 0) return { ok: true, status: from };
  if (!canTransition(from, to)) return { ok: false, status: from };
  const { data: updated } = await sb
    .from("map_jobs")
    .update({ status: to, ...extra })
    .eq("id", jobId)
    .eq("status", row.status)
    .select("status");
  return updated?.length ? { ok: true, status: to } : { ok: false, status: from };
}

/**
 * Ask Stripe directly whether a Checkout Session paid for this job. Used when the
 * customer lands back on the site before the webhook has arrived.
 */
export async function verifyCheckout(checkoutSessionId: string, jobId: string): Promise<{ paid: boolean; email?: string; paymentIntent?: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !checkoutSessionId.startsWith("cs_")) return { paid: false };
  try {
    const s = await new Stripe(key).checkout.sessions.retrieve(checkoutSessionId);
    const paid = s.payment_status === "paid" && s.metadata?.jobId === jobId;
    return { paid, email: s.customer_details?.email ?? undefined, paymentIntent: String(s.payment_intent ?? "") };
  } catch {
    return { paid: false };
  }
}

export { isPaid };
