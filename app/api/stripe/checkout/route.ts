import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getServiceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ error: "Stripe is not configured (missing STRIPE_SECRET_KEY)." }, { status: 503 });
  }
  const stripe = new Stripe(key);

  const body = (await req.json().catch(() => ({}))) as { jobId?: string; sessionId?: string; title?: string };
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const jobId = body.jobId ?? "";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: 500,
            product_data: {
              name: "CartoMapper — print-ready map (PDF)",
              description: body.title ? String(body.title).slice(0, 200) : "One publication-quality map, 300 DPI PDF.",
            },
          },
        },
      ],
      success_url: `${appUrl}/download?job=${encodeURIComponent(jobId)}&paid=1`,
      cancel_url: `${appUrl}/create?canceled=1`,
      metadata: { jobId, sessionId: body.sessionId ?? "" },
    });

    const sb = getServiceSupabase();
    if (sb && jobId) {
      try {
        await sb
          .from("map_jobs")
          .update({ stripe_checkout_session_id: session.id, status: "generating" })
          .eq("id", jobId);
      } catch (e) {
        console.error("checkout: job update skipped", e);
      }
    }

    return NextResponse.json({ url: session.url, id: session.id });
  } catch (err) {
    console.error("checkout error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Checkout failed" }, { status: 500 });
  }
}
