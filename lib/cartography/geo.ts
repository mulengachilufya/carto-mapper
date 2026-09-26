import { feature } from "topojson-client";
import { geoArea, geoCentroid } from "d3-geo";
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from "geojson";

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

/**
 * The parts of a country worth framing a map on: its largest polygon plus any others
 * at least `ratio` of its size. Drops far-flung small islands (Easter Island for
 * Chile, Hawaii for the USA, French Guiana for France) that would otherwise shrink
 * the mainland to a sliver. Everything is still drawn; this only guides the fit.
 */
export function mainParts(f: CountryFeature, ratio = 0.2): Feature {
  const g = f.geometry;
  if (!g || g.type !== "MultiPolygon") return f;
  const polys = (g as MultiPolygon).coordinates.map((coordinates) => ({
    coordinates,
    area: geoArea({ type: "Polygon", coordinates }),
  }));
  const max = Math.max(...polys.map((p) => p.area));
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "MultiPolygon", coordinates: polys.filter((p) => p.area >= max * ratio).map((p) => p.coordinates) },
  };
}

export function centroidOf(f: Feature): [number, number] {
  return geoCentroid(f as Parameters<typeof geoCentroid>[0]) as [number, number];
}

/**
 * A GeoJSON rectangle, used as a fit target for continent/point extents.
 * d3-geo treats polygons as spherical and expects a CLOCKWISE exterior ring;
 * a counter-clockwise ring means "the whole globe except this box", which made
 * every continent map fit to the entire world.
 */
export function bboxPolygon(
  w: number,
  s: number,
  e: number,
  n: number,
): Feature<Polygon> {
  // Densify the edges: on a sphere a bare 4-corner box has great-circle sides that
  // bow away from the parallels, so wide boxes would fit the wrong extent.
  const steps = Math.max(2, Math.ceil(Math.max(e - w, n - s) / 2));
  const ring: [number, number][] = [];
  for (let i = 0; i < steps; i++) ring.push([w, s + ((n - s) * i) / steps]);
  for (let i = 0; i < steps; i++) ring.push([w + ((e - w) * i) / steps, n]);
  for (let i = 0; i < steps; i++) ring.push([e, n - ((n - s) * i) / steps]);
  for (let i = 0; i < steps; i++) ring.push([e - ((e - w) * i) / steps, s]);
  ring.push([w, s]);
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [ring] },
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
  "central africa": [8, -14, 34, 24],
  "latin america": [-118, -56, -34, 33],
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
