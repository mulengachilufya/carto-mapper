"use client";

import { useMemo } from "react";
import type { FeatureCollection } from "geojson";
import { CartoMap } from "@/components/cartography/CartoMap";
import { MAP_TYPES_CATALOGUE, type MapTypeDef } from "@/lib/mapTypes";
import { Button } from "@/components/ui/Button";

interface Props {
  geo: FeatureCollection | null;
  selected: string | null;
  recommended?: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export function MapTypeStep({ geo, selected, recommended, onSelect, onBack, onNext }: Props) {
  return (
    <div>
      <h2 className="font-serif text-2xl font-semibold tracking-tight">Choose your map type</h2>
      <p className="mt-1.5 text-muted">
        Each is a real cartographic technique with its own job. We&apos;ve highlighted a recommendation — pick whatever fits.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MAP_TYPES_CATALOGUE.map((def) => (
          <MapTypeCard
            key={def.id}
            def={def}
            geo={geo}
            active={selected === def.id}
            recommended={recommended === def.id}
            onSelect={() => def.ready && onSelect(def.id)}
          />
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Button onClick={onBack} variant="ghost">← Back</Button>
        <Button onClick={onNext} disabled={!selected} size="lg">Continue</Button>
      </div>
    </div>
  );
}

function MapTypeCard({
  def,
  geo,
  active,
  recommended,
  onSelect,
}: {
  def: MapTypeDef;
  geo: FeatureCollection | null;
  active: boolean;
  recommended: boolean;
  onSelect: () => void;
}) {
  const sample = useMemo(() => (geo && def.ready && def.sample ? def.sample(geo) : null), [geo, def]);

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!def.ready}
      className={`group overflow-hidden rounded-xl border text-left transition-colors ${
        active ? "border-accent ring-1 ring-accent" : "border-line hover:border-accent/50"
      } ${def.ready ? "" : "opacity-70"}`}
    >
      <div className="aspect-[3/2] w-full overflow-hidden bg-paper-2">
        {sample && geo ? (
          <CartoMap spec={sample.spec} data={sample.data} geo={geo} width={360} height={240} className="h-auto w-full" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            {def.ready ? "Rendering…" : "Coming soon"}
          </div>
        )}
      </div>
      <div className="p-3.5">
        <div className="flex items-center gap-2">
          <span className="font-medium">{def.name}</span>
          {recommended && def.ready && (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent-2">Recommended</span>
          )}
          {!def.ready && (
            <span className="rounded-full bg-paper-2 px-2 py-0.5 text-[11px] font-medium text-muted">Soon</span>
          )}
        </div>
        <p className="mt-1 text-[13px] leading-snug text-muted">{def.tagline}</p>
      </div>
    </button>
  );
}
