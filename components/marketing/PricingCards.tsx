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
  { name: "Single map", price: "$5", items: ["One print-ready PDF (300 DPI)", "1 free revision included", "A4 or Letter, your choice"], featured: true },
  { name: "3-map pack", price: "$12", items: ["Three maps — save $3", "1 free revision each", "Use any time"], packType: "triple" },
  { name: "5-map pack", price: "$18", items: ["Five maps — save $7", "1 free revision each", "Best for reports & series"], packType: "five" },
];

export function PricingCards() {
  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-3">
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
      className={`relative rounded-[3px] p-7 ring-1 ${
        plan.featured ? "bg-room-2 ring-brass/50" : "bg-room-2/70 ring-room-line"
      }`}
    >
      {plan.featured && (
        <span className="absolute -top-2.5 left-7 rounded-full bg-brass px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-room">
          Most common
        </span>
      )}
      <h3 className="font-medium text-paper">{plan.name}</h3>
      <p className="mt-2 font-serif text-4xl font-semibold text-paper">{plan.price}</p>
      <ul className="mt-5 space-y-2.5 text-sm text-parchment-muted">
        {plan.items.map((it) => (
          <li key={it} className="flex gap-2.5">
            <Tick />
            <span>{it}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6">
        {plan.packType ? (
          <Button
            onClick={buyPack}
            disabled={busy}
            variant="secondary"
            className="w-full border-room-line bg-transparent text-paper hover:bg-room-3"
          >
            {busy ? "Redirecting…" : "Buy pack"}
          </Button>
        ) : (
          <Button href="/create" className="w-full bg-brass text-room hover:bg-brass/90">
            Create my map
          </Button>
        )}
      </div>
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </div>
  );
}

function Tick() {
  return (
    <svg width={16} height={16} viewBox="0 0 22 22" className="mt-0.5 shrink-0" aria-hidden>
      <circle cx="11" cy="11" r="11" fill="var(--color-brass)" opacity="0.16" />
      <path d="M6.5 11.3l3 3 6-6.4" fill="none" stroke="var(--color-brass)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
