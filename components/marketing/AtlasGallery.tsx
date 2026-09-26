"use client";

import { useEffect, useMemo, useState } from "react";
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

function Plate({ s, geo, index }: { s: Specimen; geo: FeatureCollection; index: number }) {
  const subs = useSubs(s.subdivisionsOf);
  const built = useMemo(() => s.build(geo, subs), [s, geo, subs]);
  const portrait = built.spec.page.orientation === "portrait";
  const w = portrait ? 620 : 880;
  const h = Math.round(portrait ? w * Math.SQRT2 : w / Math.SQRT2);
  return (
    <figure className="atlas-plate" data-specimen={s.id}>
      <CartoMap spec={built.spec} data={built.data} geo={geo} subdivisions={subs} width={w} height={h} className="h-auto w-full" />
      <figcaption>
        <span className="atlas-plate__no">Plate {String(index + 1).padStart(2, "0")}</span>
        <span className="atlas-plate__title">{s.title}</span>
        <span className="atlas-plate__note">{s.note}</span>
      </figcaption>
    </figure>
  );
}

export function AtlasGallery({ only }: { only?: string[] }) {
  const { geo } = useCountries("50m");
  const list = only ? SPECIMENS.filter((s) => only.includes(s.id)) : SPECIMENS;
  if (!geo) return <div className="atlas-loading">Unfolding the atlas…</div>;
  return (
    <div className="atlas-gallery">
      {list.map((s, i) => (
        <Plate key={s.id} s={s} geo={geo} index={i} />
      ))}
    </div>
  );
}
