"use client";

import { Button } from "@/components/ui/Button";
import { getPaletteColors } from "@/lib/cartography/palettes";
import type { MapSpec } from "@/lib/mapspec/schema";
import { COLOURS, LOOKS } from "./looks";

interface Props {
  look: MapSpec["style"] | null;
  palette: string | null;
  onLook: (l: MapSpec["style"] | null) => void;
  onPalette: (p: string | null) => void;
  onBack: () => void;
  onNext: () => void;
}

const HEX = /^#[0-9a-f]{6}$/i;

function Ramp({ name }: { name: string }) {
  return (
    <span className="flex h-7 overflow-hidden rounded-md">
      {getPaletteColors(name, 5).map((c) => (
        <span key={c} className="flex-1" style={{ background: c }} />
      ))}
    </span>
  );
}

const card = (on: boolean) =>
  `rounded-xl border p-2.5 text-left text-sm transition-colors ${
    on ? "border-accent bg-accent/10 text-ink ring-1 ring-accent" : "border-line text-muted hover:border-accent/50 hover:text-ink"
  }`;

/** The look and the colours, chosen by eye. The engine still picks the map type from your data. */
export function LookStep({ look, palette, onLook, onPalette, onBack, onNext }: Props) {
  const custom = palette && HEX.test(palette) ? palette : null;
  return (
    <div>
      <h2 className="display text-4xl font-semibold text-ink">Pick a look and colours</h2>
      <p className="mt-1.5 text-muted">Or leave both on Auto and the engine chooses from your subject. You can change them again on the preview.</p>

      <h3 className="eyebrow mt-8 text-atlas-leather">Look</h3>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <button type="button" onClick={() => onLook(null)} className={card(look === null)}>
          <span className="mb-2 flex h-14 items-center justify-center rounded-lg border border-dashed border-line text-lg">✦</span>
          <span className="block font-medium">Auto</span>
          <span className="block text-[11px] leading-tight opacity-80">Engine decides</span>
        </button>
        {LOOKS.map((l) => (
          <button key={l.id} type="button" onClick={() => onLook(l.id)} className={card(look === l.id)}>
            <span className="mb-2 block h-14 rounded-lg border border-line/60" style={{ background: l.swatch }} />
            <span className="block font-medium">{l.label}</span>
            <span className="block text-[11px] leading-tight opacity-80">{l.hint}</span>
          </button>
        ))}
      </div>

      <h3 className="eyebrow mt-10 text-atlas-leather">Colours</h3>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <button type="button" onClick={() => onPalette(null)} className={card(palette === null)}>
          <span className="flex h-7 items-center justify-center rounded-md border border-dashed border-line">✦</span>
          <span className="mt-2 block font-medium">Auto</span>
          <span className="block text-[11px] leading-tight opacity-80">Suits the subject</span>
        </button>
        {COLOURS.map((c) => (
          <button key={c.id} type="button" onClick={() => onPalette(c.id)} className={card(palette === c.id)}>
            <Ramp name={c.id} />
            <span className="mt-2 block font-medium">{c.label}</span>
          </button>
        ))}
        <label className={`${card(Boolean(custom))} cursor-pointer`}>
          {custom ? <Ramp name={custom} /> : <span className="block h-7 rounded-md bg-[conic-gradient(#8b2e26,#c68a3a,#1f5c4d,#2c5ea8,#8b2e26)]" />}
          <span className="mt-2 block font-medium">Brand colour</span>
          <span className="block text-[11px] leading-tight opacity-80">{custom ?? "Pick any colour"}</span>
          <input
            type="color"
            value={custom ?? "#1f5c4d"}
            onChange={(e) => onPalette(e.target.value)}
            className="sr-only"
            aria-label="Brand colour"
          />
        </label>
      </div>
      <p className="mt-3 text-xs text-muted">Maps of categories (sites by type) keep distinct colours so every category stays readable.</p>

      <div className="mt-10 flex items-center justify-between">
        <Button onClick={onBack} variant="ghost">← Back</Button>
        <Button onClick={onNext} size="lg">Next: branding →</Button>
      </div>
    </div>
  );
}
