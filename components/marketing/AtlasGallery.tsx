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

export function AtlasGallery({ only }: { only?: string[] }) {
  const list = only ? SPECIMENS.filter((s) => only.includes(s.id)) : SPECIMENS;
  return (
    <div className="grid gap-x-10 gap-y-16 lg:grid-cols-2">
      {list.map((s) => (
        <SpecimenPlate key={s.id} id={s.id} />
      ))}
    </div>
  );
}
