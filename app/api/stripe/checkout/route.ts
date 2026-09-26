import { NextResponse } from "next/server";
import Stripe from "stripe";
import { advanceJob, getJob, isLocalJobId } from "@/lib/jobs";
import { isPaid } from "@/lib/workflow";

export const runtime = "nodejs";

const PACKS = {
  single: { credits: 1, amount: 500, label: "CartoMapper — print-ready map (PDF + SVG)" },
  triple: { credits: 3, amount: 1200, label: "CartoMapper — 3-map pack" },
  five: { credits: 5, amount: 1800, label: "CartoMapper — 5-map pack" },
} as const;

type PackType = keyof typeof PACKS;

export async function POST(req: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ error: "Payments aren't set up on this site yet (missing STRIPE_SECRET_KEY)." }, { status: 503 });
  }
  const stripe = new Stripe(key);

  const body = (await req.json().catch(() => ({}))) as {
    jobId?: string;
    sessionId?: string;
    title?: string;
    packType?: PackType;
  };
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const packType: PackType = body.packType && body.packType in PACKS ? body.packType : "single";
  const pack = PACKS[packType];
  const jobId = body.jobId ?? "";
  const sessionId = body.sessionId ?? "";

  if (packType !== "single" && !sessionId) {
    return NextResponse.json({ error: "sessionId is required to buy a pack." }, { status: 400 });
  }
  if (packType === "single") {
    if (!jobId) return NextResponse.json({ error: "jobId is required for a single-map checkout." }, { status: 400 });
    // Gate: never take money twice for the same map.
    const job = isLocalJobId(jobId) ? null : await getJob(jobId);
    if (job && isPaid(job.status)) {
      return NextResponse.json({ alreadyPaid: true, url: `${appUrl}/download?job=${encodeURIComponent(jobId)}` });
    }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: pack.amount,
            product_data: {
              name: pack.label,
              description:
                packType === "single" && body.title
                  ? String(body.title).slice(0, 200)
                  : `${pack.credits} print-ready maps (vector PDF + SVG). Credits never expire.`,
            },
          },
        },
      ],
      allow_promotion_codes: true,
      // Stripe's return carries the session id so the download page can verify
      // payment directly, even before the webhook arrives.
      success_url:
        packType === "single"
          ? `${appUrl}/download?job=${encodeURIComponent(jobId)}&cs={CHECKOUT_SESSION_ID}`
          : `${appUrl}/create?credited=1&cs={CHECKOUT_SESSION_ID}`,
      cancel_url: packType === "single" ? `${appUrl}/create?canceled=1` : `${appUrl}/#pricing`,
      metadata: { jobId, sessionId, packType, credits: String(pack.credits) },
      payment_intent_data: { metadata: { jobId, sessionId, packType } },
    });

    if (packType === "single") {
      await advanceJob(jobId, "checkout", { stripe_checkout_session_id: session.id });
    }

    return NextResponse.json({ url: session.url, id: session.id });
  } catch (err) {
    console.error("checkout error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Checkout failed" }, { status: 500 });
  }
}
