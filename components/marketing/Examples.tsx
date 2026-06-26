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

function Frame({ children, caption }: { children: ReactNode; caption: ReactNode }) {
  return (
    <figure className="overflow-hidden rounded-xl border border-[--color-line] bg-[--color-paper] shadow-sm">
      <div className="bg-[--color-paper]">{children}</div>
      <figcaption className="border-t border-[--color-line] px-4 py-2.5 text-[13px] leading-snug">{caption}</figcaption>
    </figure>
  );
}

function Skeleton({ ratio = "3 / 2" }: { ratio?: string }) {
  return <div className="w-full animate-pulse bg-[--color-paper-2]" style={{ aspectRatio: ratio }} />;
}

export function FeaturedMap() {
  const { geo } = useCountries("50m");
  const ex = useMemo(() => (geo ? worldChoropleth(geo) : null), [geo]);
  return (
    <Frame
      caption={
        geo && ex ? (
          <>
            <span className="font-medium">{ex.label}</span>{" "}
            <span className="text-[--color-muted]">— {ex.blurb}</span>
          </>
        ) : (
          <span className="text-[--color-muted]">Rendering a sample map…</span>
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
          caption={
            <>
              <span className="font-medium">{ex.label}</span>{" "}
              <span className="text-[--color-muted]">— {ex.blurb}</span>
            </>
          }
        >
          <CartoMap spec={ex.spec} data={ex.data} geo={geo} width={520} height={360} className="h-auto w-full" />
        </Frame>
      ))}
    </div>
  );
}
