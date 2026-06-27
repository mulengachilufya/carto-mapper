import { feature } from "topojson-client";
import { geoCentroid } from "d3-geo";
import type { Feature, FeatureCollection, Geometry, Polygon } from "geojson";

export interface CountryProps {
  name: string;
}
export type CountryFeature = Feature<Geometry, CountryProps>;

const cache = new Map<string, FeatureCollection>();

/** Load Natural Earth countries (TopoJSON) and convert to GeoJSON features. */
export async function loadCountries(
  detail: "110m" | "50m" = "50m",
  baseUrl = "",
): Promise<FeatureCollection> {
  if (cache.has(detail)) return cache.get(detail)!;
  const res = await fetch(`${baseUrl}/geodata/countries-${detail}.json`);
  if (!res.ok) throw new Error(`Failed to load geodata countries-${detail}`);
  const topo = await res.json();
  const fc = feature(topo, topo.objects.countries) as unknown as FeatureCollection;
  cache.set(detail, fc);
  return fc;
}

export function normalizeName(s: string): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Common user spellings → the normalized Natural Earth name.
const ALIASES: Record<string, string> = {
  usa: "united states of america",
  "united states": "united states of america",
  "u s a": "united states of america",
  america: "united states of america",
  uk: "united kingdom",
  "great britain": "united kingdom",
  britain: "united kingdom",
  drc: "dem rep congo",
  "dr congo": "dem rep congo",
  "democratic republic of the congo": "dem rep congo",
  "congo kinshasa": "dem rep congo",
  "republic of the congo": "congo",
  "congo brazzaville": "congo",
  "ivory coast": "cote d ivoire",
  "czech republic": "czechia",
  bosnia: "bosnia and herz",
  "central african republic": "central african rep",
  "south sudan": "s sudan",
  "dominican republic": "dominican rep",
  "equatorial guinea": "eq guinea",
  "western sahara": "w sahara",
  swaziland: "eswatini",
  burma: "myanmar",
  "united republic of tanzania": "tanzania",
};

export function buildNameIndex(fc: FeatureCollection): Map<string, CountryFeature> {
  const idx = new Map<string, CountryFeature>();
  for (const f of fc.features as CountryFeature[]) {
    const nm = normalizeName(f.properties?.name ?? "");
    if (nm) idx.set(nm, f);
  }
  return idx;
}

/** Best-effort join of a data row's place name to a country feature. */
export function matchFeature(
  name: string,
  index: Map<string, CountryFeature>,
): CountryFeature | undefined {
  const n = normalizeName(name);
  if (!n) return undefined;
  if (index.has(n)) return index.get(n);
  const alias = ALIASES[n];
  if (alias && index.has(alias)) return index.get(alias);
  // No fuzzy "contains" matching — it mis-assigns (e.g. "Niger" → "Nigeria",
  // "Sudan" → "South Sudan"). A miss is safe (renders as "no data"); a wrong
  // match silently paints your value onto the wrong country.
  return undefined;
}

export function findCountry(
  fc: FeatureCollection,
  regionName: string,
): CountryFeature | undefined {
  return matchFeature(regionName, buildNameIndex(fc));
}

export function centroidOf(f: Feature): [number, number] {
  return geoCentroid(f as Parameters<typeof geoCentroid>[0]) as [number, number];
}

/** A GeoJSON rectangle, used as a fit target for continent/point extents. */
export function bboxPolygon(
  w: number,
  s: number,
  e: number,
  n: number,
): Feature<Polygon> {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [w, s],
          [e, s],
          [e, n],
          [w, n],
          [w, s],
        ],
      ],
    },
  };
}

export const CONTINENT_BBOX: Record<string, [number, number, number, number]> = {
  africa: [-20, -36, 52, 38],
  europe: [-25, 34, 45, 72],
  asia: [25, -12, 150, 78],
  "north america": [-170, 5, -50, 75],
  "south america": [-82, -56, -34, 13],
  oceania: [110, -50, 180, 0],
  "middle east": [25, 12, 63, 42],
  "east africa": [28, -12, 52, 18],
  "west africa": [-18, 4, 16, 25],
  "southern africa": [11, -35, 41, -8],
};

export function continentBBoxPolygon(name: string): Feature<Polygon> | null {
  const box = CONTINENT_BBOX[normalizeName(name)];
  return box ? bboxPolygon(box[0], box[1], box[2], box[3]) : null;
}

export interface LatLon {
  lat: number;
  lon: number;
}

/** Padded bounding box around a set of points (for point/city maps). */
export function pointsBBoxPolygon(points: LatLon[], padFraction = 0.15): Feature<Polygon> | null {
  const pts = points.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lon),
  );
  if (!pts.length) return null;
  let w = Infinity,
    s = Infinity,
    e = -Infinity,
    n = -Infinity;
  for (const p of pts) {
    w = Math.min(w, p.lon);
    e = Math.max(e, p.lon);
    s = Math.min(s, p.lat);
    n = Math.max(n, p.lat);
  }
  const padX = Math.max((e - w) * padFraction, 0.5);
  const padY = Math.max((n - s) * padFraction, 0.5);
  return bboxPolygon(w - padX, s - padY, e + padX, n + padY);
}
