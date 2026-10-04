"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";
import { CartoMap } from "@/components/cartography/CartoMap";
import { useCountries } from "@/components/cartography/useCountries";
import { loadSubdivisions } from "@/lib/cartography/geo";
import type { Subdivisions } from "@/lib/cartography/join";
import { SPECIMENS, type Specimen } from "@/lib/specimens";

function useSubs(country?: string): Subdivisions | undefined {
  const [subs, setSubs] = useState<{ c: string; v: Subdivisions } | null>(null);
  useEffect(() => {
    if (!country) return;
    let alive = true;
    Promise.all([loadSubdivisions(country, 1), loadSubdivisions(country, 2)]).then(
      ([adm1, adm2]) => alive && setSubs({ c: country, v: { adm1, adm2 } }),
    );
    return () => {
      alive = false;
    };
  }, [country]);
  return country && subs?.c === country ? subs.v : undefined;
}

/** Mount children only once they come near the viewport (maps fetch terrain). */
function useNearViewport<T extends Element>() {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return [ref, near] as const;
}

function SpecimenMap({ s, geo }: { s: Specimen; geo: FeatureCollection }) {
  const subs = useSubs(s.subdivisionsOf);
  const built = useMemo(() => s.build(geo, subs), [s, geo, subs]);
  const portrait = built.spec.page.orientation === "portrait";
  const w = portrait ? 620 : 880;
  const h = Math.round(portrait ? w * Math.SQRT2 : w / Math.SQRT2);
  return <CartoMap spec={built.spec} data={built.data} geo={geo} subdivisions={subs} width={w} height={h} className="h-auto w-full" />;
}

/**
 * A live specimen plate: the real engine rendering an example map. Shows a paper
 * placeholder of the right shape until it scrolls near, then renders.
 */
export function SpecimenPlate({ id, caption = true, className }: { id: string; caption?: boolean; className?: string }) {
  const s = SPECIMENS.find((x) => x.id === id);
  const { geo } = useCountries("50m");
  const [ref, near] = useNearViewport<HTMLElement>();
  if (!s) return null;
  const index = SPECIMENS.indexOf(s);
  return (
    <figure ref={ref} className={className} data-specimen={s.id}>
      <div className="plate">
        {geo && near ? (
          <SpecimenMap s={s} geo={geo} />
        ) : (
          <div className="aspect-[1.414/1] w-full animate-pulse bg-atlas-paper-2" />
        )}
      </div>
      {caption && (
        <figcaption className="mt-3 flex items-baseline gap-3 text-sm">
          <span className="eyebrow shrink-0 text-atlas-leather">Plate {String(index + 1).padStart(2, "0")}</span>
          <span className="text-atlas-ink-2">
            <span className="font-medium text-atlas-ink">{s.title}.</span> {s.note}
          </span>
        </figcaption>
      )}
    </figure>
  );
}

/** Card colours per map style, so the map bleeds into its poster. */
const POSTER_THEME: Record<string, { bg: string; fg: string; accent: string; soft: string }> = {
  night: { bg: "#0b1412", fg: "#f2f5f3", accent: "#e8b86a", soft: "rgba(244,239,228,.62)" },
  editorial: { bg: "#ffffff", fg: "#111614", accent: "#8b2e26", soft: "rgba(28,26,23,.6)" },
  dots: { bg: "#ffffff", fg: "#111614", accent: "#1f5c4d", soft: "rgba(28,26,23,.6)" },
  atlas: { bg: "#ffffff", fg: "#111614", accent: "#8b2e26", soft: "rgba(28,26,23,.6)" },
  classic: { bg: "#ffffff", fg: "#111614", accent: "#8b2e26", soft: "rgba(28,26,23,.6)" },
  minimal: { bg: "#ffffff", fg: "#111614", accent: "#1f5c4d", soft: "rgba(28,26,23,.6)" },
};
const STYLE_NAME: Record<string, string> = { night: "Night", editorial: "Editorial", dots: "Dots", atlas: "Atlas", classic: "Classic", minimal: "Minimal" };

/**
 * A showcase poster: the same live engine map, framed like a social post, who it's
 * for, one line, the map, and the sentence that made it.
 */
export function PosterCard({ id, className, compact }: { id: string; className?: string; compact?: boolean }) {
  const s = SPECIMENS.find((x) => x.id === id);
  const { geo } = useCountries("50m");
  const [ref, near] = useNearViewport<HTMLElement>();
  if (!s) return null;
  const style = s.build({ type: "FeatureCollection", features: [] }).spec.style;
  const t = POSTER_THEME[style] ?? POSTER_THEME.editorial;
  return (
    <figure ref={ref} className={`overflow-hidden rounded-[22px] shadow-[0_18px_50px_-20px_rgba(0,0,0,.35)] ${className ?? ""}`} style={{ background: t.bg, color: t.fg, boxShadow: style === "night" ? "inset 0 0 0 1px rgba(244,239,228,.1)" : undefined }} data-specimen={s.id}>
      <div className={compact ? "px-5 pt-5 sm:px-6 sm:pt-6" : "px-6 pt-6 sm:px-8 sm:pt-8"}>
        <div className="flex items-baseline justify-between gap-4">
          <p className="eyebrow" style={{ color: t.accent }}>{s.poster.eyebrow}</p>
          {s.poster.stat && !compact && (
            <p className="text-right">
              <span className="display block text-2xl font-semibold leading-none sm:text-3xl">{s.poster.stat[0]}</span>
              <span className="text-xs" style={{ color: t.soft }}>{s.poster.stat[1]}</span>
            </p>
          )}
        </div>
        <h3 className={`display mt-3 font-medium leading-[1.02] tracking-tight ${compact ? "text-2xl sm:text-[1.7rem]" : "text-3xl sm:text-[2.6rem]"}`}>
          {s.poster.headline} {s.poster.em && <em className="font-normal" style={{ color: t.accent }}>{s.poster.em}</em>}
        </h3>
      </div>
      <div className="mt-2">
        {geo && near ? <SpecimenMap s={s} geo={geo} /> : <div className="aspect-[1.414/1] w-full animate-pulse" style={{ background: t.bg }} />}
      </div>
      <figcaption className={`flex items-center justify-between gap-4 border-t text-[13px] ${compact ? "px-5 py-3 sm:px-6" : "px-6 py-4 sm:px-8"}`} style={{ borderColor: t.soft.replace(/[\d.]+\)$/, ".15)"), color: t.soft }}>
        <span className="truncate">Typed: <span style={{ color: t.fg }}>“{s.poster.prompt}”</span></span>
        <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: t.accent, color: t.bg }}>{STYLE_NAME[style] ?? style}</span>
      </figcaption>
    </figure>
  );
}

export function AtlasGallery({ only }: { only?: string[] }) {
  const list = only ? SPECIMENS.filter((s) => only.includes(s.id)) : SPECIMENS;
  return (
    <div className="gap-8 md:columns-2 lg:gap-10">
      {list.map((s) => (
        <PosterCard key={s.id} id={s.id} className="mb-8 break-inside-avoid lg:mb-10" />
      ))}
    </div>
  );
}
