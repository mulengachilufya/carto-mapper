"use client";

import { INDUSTRIES } from "@/lib/industries";
import { Button } from "@/components/ui/Button";

interface Props {
  industryId: string | null;
  customIndustry: string;
  vibe: string;
  onChange: (patch: { industryId?: string; customIndustry?: string; vibe?: string }) => void;
  onNext: () => void;
}

const VIBE_EXAMPLES = [
  "Where our clinics are across Zambia, coloured by how many patients they serve",
  "All our project sites in East Africa, for the donor report",
  "Football pitch locations across London boroughs",
];

export function IndustryStep({ industryId, customIndustry, vibe, onChange, onNext }: Props) {
  const selected = INDUSTRIES.find((i) => i.id === industryId);
  const isCustom = selected?.custom;
  const canContinue = Boolean(industryId) && (!isCustom || customIndustry.trim().length > 1);

  return (
    <div>
      <h2 className="font-serif text-2xl font-semibold tracking-tight">What are you mapping?</h2>
      <p className="mt-1.5 text-muted">Pick the field that fits best. It tailors the questions that follow.</p>

      <div className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {INDUSTRIES.map((ind) => {
          const active = ind.id === industryId;
          return (
            <button
              key={ind.id}
              type="button"
              onClick={() => onChange({ industryId: ind.id })}
              className={`rounded-xl border p-4 text-left transition-colors ${
                active
                  ? "border-accent bg-paper ring-1 ring-accent"
                  : "border-line bg-paper hover:border-accent/50 hover:bg-paper-2"
              }`}
            >
              <div className="font-medium">{ind.name}</div>
              <div className="mt-1 text-[13px] leading-snug text-muted">{ind.blurb}</div>
            </button>
          );
        })}
      </div>

      {isCustom && (
        <div className="mt-5">
          <label className="text-sm font-medium">Describe your industry or use case</label>
          <input
            value={customIndustry}
            onChange={(e) => onChange({ customIndustry: e.target.value })}
            placeholder="e.g. Beekeeping cooperatives, archaeological dig sites…"
            className="mt-1.5 w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-[15px] outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>
      )}

      {selected && (
        <div className="mt-6">
          <label className="text-sm font-medium">
            Describe your map in plain English <span className="text-muted">(optional, recommended)</span>
          </label>
          <textarea
            value={vibe}
            onChange={(e) => onChange({ vibe: e.target.value })}
            rows={3}
            placeholder="The more you tell us — places, what to colour by — the closer the first draft."
            className="mt-1.5 w-full resize-none rounded-lg border border-line bg-paper px-3.5 py-3 text-[15px] outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <ul className="mt-2 space-y-1 text-[13px] text-muted">
            {VIBE_EXAMPLES.map((e) => (
              <li key={e} className="flex gap-2">
                <span className="text-accent">“</span>
                <button type="button" onClick={() => onChange({ vibe: e })} className="text-left hover:text-ink hover:underline">
                  {e}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 flex justify-end">
        <Button onClick={onNext} disabled={!canContinue} size="lg">
          Continue
        </Button>
      </div>
    </div>
  );
}
