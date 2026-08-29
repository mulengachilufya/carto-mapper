"use client";

import { useMemo, type ReactNode } from "react";
import type { FeatureCollection } from "geojson";
import { useCountries } from "@/components/cartography/useCountries";
import { CartoMap } from "@/components/cartography/CartoMap";
import { parseMapSpec, type MapSpec } from "@/lib/mapspec/schema";
import { generateSample } from "@/lib/data/sample";
import type { Row } from "@/lib/data/parse";
import type { CountryFeature } from "@/lib/cartography/geo";

interface Ex {
  label: string;
  blurb: string;
  spec: MapSpec;
  data: Row[];
}

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function worldChoropleth(geo: FeatureCollection): Ex {
  const sample = generateSample(geo, { industry: "research", answers: { geographic_scope: "global", show_what: "values" } });
  return {
    label: "World choropleth",
    blurb: "sequential ColorBrewer ramp, quantile classes, graticule, no scale bar",
    data: sample.table.rows,
    spec: parseMapSpec({
      title: "Development Index by Country",
      subtitle: "A worldwide comparison",
      mapType: "choropleth",
      geography: { level: "world", region: "World" },
      data: { nameField: "country", valueField: "value", valueLabel: "Index", valueFormat: "," },
      symbology: { palette: "YlGnBu", paletteKind: "sequential", classes: 5, classification: "quantile" },
      furniture: { title: true, legend: true, source: true, scalebar: false, north_arrow: false, graticule: true, caption: false },
    }),
  };
}

function zambiaPoints(geo: FeatureCollection): Ex {
  const sample = generateSample(geo, {
    industry: "healthcare",
    answers: { geographic_scope: "national", show_what: "volume" },
    vibe: "clinics across Zambia",
  });
  return {
    label: "Proportional symbols",
    blurb: "equal-area conic on the country, circles by value, scale bar + north arrow",
    data: sample.table.rows,
    spec: parseMapSpec({
      title: "Health Facilities in Zambia",
      subtitle: "Clinics sized by patients served",
      mapType: "proportional_symbol",
      geography: { level: "country", region: "Zambia" },
      data: { nameField: "name", latField: "latitude", lonField: "longitude", valueField: "value", valueLabel: "Patients / year", valueFormat: "," },
      symbology: { palette: "BuGn", paletteKind: "sequential", classes: 5, classification: "quantile", minRadius: 2, maxRadius: 22 },
      furniture: { title: true, legend: true, source: true, scalebar: true, north_arrow: true, graticule: false, caption: false },
    }),
  };
}

function divergingWorld(geo: FeatureCollection): Ex {
  const picked = shuffle(geo.features as CountryFeature[]).slice(0, 30);
  const data: Row[] = picked.map((f) => ({ country: f.properties.name, value: Math.round(Math.random() * 30 - 15) }));
  return {
    label: "Diverging choropleth",
    blurb: "diverging palette around a midpoint — the right tool for change data",
    data,
    spec: parseMapSpec({
      title: "Population Change by Country",
      subtitle: "Ten-year change (%)",
      mapType: "choropleth",
      geography: { level: "world", region: "World" },
      data: { nameField: "country", valueField: "value", valueLabel: "Change (%)", valueFormat: "+.0f" },
      symbology: { palette: "RdBu", paletteKind: "diverging", classes: 5, classification: "equal_interval", reverse: false },
      furniture: { title: true, legend: true, source: true, scalebar: false, north_arrow: false, graticule: true, caption: false },
    }),
  };
}

function Frame({
  children,
  caption,
  plate,
}: {
  children: ReactNode;
  caption: ReactNode;
  plate?: string;
}) {
  return (
    <figure className="group relative overflow-hidden rounded-[3px] bg-paper p-2 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.45)] ring-1 ring-room-line">
      <div className="overflow-hidden rounded-[2px] bg-paper">{children}</div>
      <RegCorner pos="tl" />
      <RegCorner pos="tr" />
      <RegCorner pos="bl" />
      <RegCorner pos="br" />
      <figcaption className="flex items-baseline justify-between gap-3 px-1 pb-1 pt-2.5 text-[13px] leading-snug">
        <span>
          {plate && <span className="mr-2 font-mono-tight text-[10px] uppercase tracking-wider text-accent-2">{plate}</span>}
          {caption}
        </span>
      </figcaption>
    </figure>
  );
}

function RegCorner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const pose: Record<string, string> = {
    tl: "top-1 left-1",
    tr: "top-1 right-1 -scale-x-100",
    bl: "bottom-8 left-1 -scale-y-100",
    br: "bottom-8 right-1 -scale-100",
  };
  return (
    <span className={`reg-mark ${pose[pos]}`} style={{ color: "var(--color-accent)" }} aria-hidden>
      <svg viewBox="0 0 15 15" fill="none">
        <path d="M0.5 6V0.5H6" stroke="currentColor" strokeWidth="1" />
        <circle cx="0.5" cy="0.5" r="1" fill="currentColor" />
      </svg>
    </span>
  );
}

function Skeleton({ ratio = "3 / 2" }: { ratio?: string }) {
  return <div className="w-full animate-pulse bg-paper-2" style={{ aspectRatio: ratio }} />;
}

export function FeaturedMap() {
  const { geo } = useCountries("50m");
  const ex = useMemo(() => (geo ? worldChoropleth(geo) : null), [geo]);
  return (
    <Frame
      plate="Plate I"
      caption={
        geo && ex ? (
          <>
            <span className="font-medium">{ex.label}</span>{" "}
            <span className="text-muted">— {ex.blurb}</span>
          </>
        ) : (
          <span className="text-muted">Rendering a sample map…</span>
        )
      }
    >
      {geo && ex ? (
        <CartoMap spec={ex.spec} data={ex.data} geo={geo} width={760} height={460} className="h-auto w-full" />
      ) : (
        <Skeleton ratio="760 / 460" />
      )}
    </Frame>
  );
}

export function ExampleGallery() {
  const { geo } = useCountries("50m");
  const examples = useMemo(() => (geo ? [zambiaPoints(geo), divergingWorld(geo)] : []), [geo]);

  if (!geo) {
    return (
      <div className="grid gap-6 sm:grid-cols-2">
        <Skeleton />
        <Skeleton />
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {examples.map((ex, i) => (
        <Frame
          key={i}
          plate={`Plate ${["II", "III", "IV", "V"][i] ?? i + 2}`}
          caption={
            <>
              <span className="font-medium">{ex.label}</span>{" "}
              <span className="text-muted">— {ex.blurb}</span>
            </>
          }
        >
          <CartoMap spec={ex.spec} data={ex.data} geo={geo} width={520} height={360} className="h-auto w-full" />
        </Frame>
      ))}
    </div>
  );
}
