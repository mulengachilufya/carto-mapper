/**
 * The life of a map job, as one explicit state machine. Every route that changes a
 * job's status goes through `advance`, so the gates are enforced in one place:
 *
 *   draft ──► preview ──► checkout ──► paid ──► delivered
 *                ▲            │          │
 *                └─ expired ◄─┘          └──► refunded (download revoked)
 *
 *   • preview   — the map exists; the customer can tweak it freely (watermarked)
 *   • checkout  — a Stripe Checkout session is open for it
 *   • paid      — Stripe confirmed payment (webhook, or verified on return)
 *   • delivered — the customer has downloaded it (re-downloads stay allowed)
 *   • expired   — checkout abandoned; back to preview on the next attempt
 *   • refunded  — money returned; downloads are locked again
 */
export const JOB_STATUSES = ["draft", "preview", "checkout", "paid", "delivered", "expired", "refunded", "failed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

const NEXT: Record<JobStatus, JobStatus[]> = {
  draft: ["preview", "failed"],
  preview: ["preview", "checkout", "paid"], // "paid" directly when a pack credit is spent
  checkout: ["checkout", "paid", "expired", "preview"],
  expired: ["preview", "checkout", "paid"],
  paid: ["paid", "delivered", "refunded"],
  delivered: ["delivered", "refunded"],
  refunded: ["refunded", "checkout", "paid"],
  failed: ["preview"],
};

/** Legacy statuses written before this state machine existed. */
const LEGACY: Record<string, JobStatus> = { generating: "checkout", complete: "delivered" };

export function normalizeStatus(s: string | null | undefined): JobStatus {
  if (!s) return "draft";
  return (JOB_STATUSES as readonly string[]).includes(s) ? (s as JobStatus) : LEGACY[s] ?? "draft";
}

export function canTransition(from: string | null | undefined, to: JobStatus): boolean {
  return NEXT[normalizeStatus(from)].includes(to);
}

/** Has this job been paid for (and not refunded)? */
export function isPaid(s: string | null | undefined): boolean {
  const st = normalizeStatus(s);
  return st === "paid" || st === "delivered";
}

/** Plain-words revisions a paid map includes before a change becomes a new map. */
export const PAID_REVISIONS_INCLUDED = 1;

/**
 * Payments are "on" when Stripe is configured. Without it (local development, or a
 * preview deploy with no keys) maps can still be downloaded — but watermarked, so a
 * misconfigured production site never gives clean maps away.
 */
export function paymentsEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
