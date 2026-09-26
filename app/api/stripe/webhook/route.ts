import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getServiceSupabase } from "@/lib/supabase/server";
import { advanceJob } from "@/lib/jobs";

export const runtime = "nodejs";

/**
 * Stripe → CartoMapper. Every event maps onto one state-machine transition:
 *
 *   checkout.session.completed (paid)       → job paid / pack credited
 *   checkout.session.async_payment_succeeded → same, for delayed payment methods
 *   checkout.session.async_payment_failed    → job back to expired
 *   checkout.session.expired                 → job expired (can check out again)
 *   charge.refunded                          → job refunded (download locked)
 *
 * Stripe retries deliveries; every handler is idempotent.
 */
export async function POST(req: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !whSecret) {
    return NextResponse.json({ error: "Stripe webhook not configured" }, { status: 503 });
  }
  const stripe = new Stripe(key);

  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig ?? "", whSecret);
  } catch (err) {
    console.error("webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      // A completed session with a delayed method (bank debit) isn't paid yet.
      if (session.payment_status !== "paid") break;
      await fulfil(session);
      break;
    }
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.jobId) await advanceJob(session.metadata.jobId, "expired");
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      // Our job id lives on the PaymentIntent (Stripe doesn't copy it onto the charge).
      let jobId: string | undefined = charge.metadata?.jobId;
      if (!jobId && charge.payment_intent) {
        const pi = await stripe.paymentIntents.retrieve(String(charge.payment_intent)).catch(() => null);
        jobId = pi?.metadata?.jobId;
      }
      // Only full refunds revoke a map; a partial refund is a goodwill gesture.
      if (jobId && charge.amount_refunded >= charge.amount) await advanceJob(jobId, "refunded");
      break;
    }
  }

  return NextResponse.json({ received: true });
}

async function fulfil(session: Stripe.Checkout.Session) {
  const meta = session.metadata ?? {};
  const packType = meta.packType ?? "single";
  const email = session.customer_details?.email ?? null;

  if (packType !== "single") {
    const sb = getServiceSupabase();
    if (!sb) return;
    // The unique index on stripe_checkout_session_id makes redelivery a safe no-op.
    const { error } = await sb.from("credit_purchases").insert({
      session_id: meta.sessionId ?? "",
      email,
      stripe_payment_intent_id: String(session.payment_intent ?? ""),
      stripe_checkout_session_id: session.id,
      credits_purchased: Number(meta.credits ?? 0),
      credits_remaining: Number(meta.credits ?? 0),
      pack_type: packType,
    });
    if (error && error.code !== "23505") console.error("webhook: pack credit insert failed", error);
    return;
  }

  if (meta.jobId) {
    await advanceJob(meta.jobId, "paid", {
      stripe_payment_intent_id: String(session.payment_intent ?? ""),
      stripe_checkout_session_id: session.id,
      paid_at: new Date().toISOString(),
      ...(email ? { email } : {}),
    });
  }
}
