"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { getSessionId } from "@/lib/session";

interface Plan {
  name: string;
  price: string;
  items: string[];
  packType?: "triple" | "five";
  featured?: boolean;
}

const PLANS: Plan[] = [
  {
    name: "Single map",
    price: "$5",
    items: ["Print-ready vector PDF + SVG", "A4 or Letter, portrait or landscape", "One change after purchase", "Your title, logo & source line"],
    featured: true,
  },
  { name: "3-map pack", price: "$12", items: ["Three maps — save $3", "One change after purchase each", "Credits never expire"], packType: "triple" },
  { name: "5-map pack", price: "$18", items: ["Five maps — save $7", "One change after purchase each", "Made for report series"], packType: "five" },
];

export function PricingCards() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {PLANS.map((p) => (
        <PriceCard key={p.name} plan={p} />
      ))}
    </div>
  );
}

function PriceCard({ plan }: { plan: Plan }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buyPack() {
    if (!plan.packType) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: getSessionId(), packType: plan.packType }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (json.url) {
        window.location.assign(json.url);
        return;
      }
      setError(json.error ?? "Checkout is unavailable right now.");
    } catch {
      setError("Checkout is unavailable right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`relative flex flex-col p-8 ${
        plan.featured ? "plate" : "border border-atlas-rule bg-atlas-card/70"
      }`}
    >
      {plan.featured && (
        <span className="absolute -top-3 left-8 z-10 rounded-full bg-atlas-red px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-atlas-paper">
          Most chosen
        </span>
      )}
      <h3 className="font-medium text-atlas-ink">{plan.name}</h3>
      <p className="display mt-2 text-5xl font-semibold text-atlas-ink">{plan.price}</p>
      <ul className="mt-6 flex-1 space-y-3 text-atlas-ink-2">
        {plan.items.map((it) => (
          <li key={it} className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rotate-45 bg-atlas-ochre" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
      <div className="relative z-10 mt-8">
        {plan.packType ? (
          <Button onClick={buyPack} disabled={busy} variant="secondary" className="w-full border-atlas-ink/25 bg-transparent text-atlas-ink hover:bg-atlas-paper-2">
            {busy ? "Opening checkout…" : "Buy pack"}
          </Button>
        ) : (
          <Button href="/create" className="w-full bg-atlas-deep text-atlas-paper hover:bg-atlas-ocean">
            Make my map
          </Button>
        )}
      </div>
      {error && <p className="mt-3 text-xs text-atlas-red">{error}</p>}
    </div>
  );
}
