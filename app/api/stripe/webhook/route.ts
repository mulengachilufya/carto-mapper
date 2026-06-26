import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getServiceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const jobId = session.metadata?.jobId;
    const sb = getServiceSupabase();
    if (sb && jobId) {
      try {
        await sb
          .from("map_jobs")
          .update({
            status: "paid",
            stripe_payment_intent_id: String(session.payment_intent ?? ""),
            stripe_checkout_session_id: session.id,
          })
          .eq("id", jobId);
      } catch (e) {
        console.error("webhook: job update failed", e);
      }
    }
  }

  return NextResponse.json({ received: true });
}
