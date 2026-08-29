import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getServiceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PACKS = {
  single: { credits: 1, amount: 500, label: "CartoMapper — print-ready map (PDF)" },
  triple: { credits: 3, amount: 1200, label: "CartoMapper — 3-map pack" },
  five: { credits: 5, amount: 1800, label: "CartoMapper — 5-map pack" },
} as const;

type PackType = keyof typeof PACKS;

export async function POST(req: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ error: "Stripe is not configured (missing STRIPE_SECRET_KEY)." }, { status: 503 });
  }
  const stripe = new Stripe(key);

  const body = (await req.json().catch(() => ({}))) as {
    jobId?: string;
    sessionId?: string;
    title?: string;
    packType?: PackType;
  };
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const packType: PackType = body.packType ?? "single";
  const pack = PACKS[packType];
  const jobId = body.jobId ?? "";
  const sessionId = body.sessionId ?? "";

  if (packType !== "single" && !sessionId) {
    return NextResponse.json({ error: "sessionId is required to buy a pack." }, { status: 400 });
  }
  if (packType === "single" && !jobId) {
    return NextResponse.json({ error: "jobId is required for a single-map checkout." }, { status: 400 });
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
                  : `${pack.credits} print-ready map${pack.credits > 1 ? "s" : ""}, 300 DPI PDF, use any time.`,
            },
          },
        },
      ],
      success_url:
        packType === "single"
          ? `${appUrl}/download?job=${encodeURIComponent(jobId)}&paid=1`
          : `${appUrl}/create?credited=1`,
      cancel_url: packType === "single" ? `${appUrl}/create?canceled=1` : `${appUrl}/#pricing?canceled=1`,
      metadata: { jobId, sessionId, packType, credits: String(pack.credits) },
    });

    const sb = getServiceSupabase();
    if (sb && packType === "single" && jobId) {
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
