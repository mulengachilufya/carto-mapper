import { feature, neighbors } from "topojson-client";
import { geoArea, geoCentroid } from "d3-geo";
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from "geojson";

export interface CountryProps {
  name: string;
  /** 0–4: a colour index no neighbouring country shares (political-atlas colouring). */
  mapcolor?: number;
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
  const fc = countriesFromTopology(await res.json());
  cache.set(detail, fc);
  return fc;
}

/**
 * Countries as GeoJSON, each with a `mapcolor` no neighbour shares — greedy graph
 * colouring over shared borders, most-connected countries first.
 */
export function countriesFromTopology(topo: {
  objects: { countries: { geometries: unknown[] } };
}): FeatureCollection {
  const fc = feature(topo as never, topo.objects.countries as never) as unknown as FeatureCollection;
  colourNeighbours(fc, topo.objects.countries.geometries);
  return fc;
}

/**
 * Give each unit a colour index (0–4) that differs from every neighbour's — the
 * political-atlas tint. Greedy, most-connected first.
 */
function colourNeighbours(fc: FeatureCollection, geometries: unknown[]) {
  const adj = neighbors(geometries as never);
  const order = adj.map((n, i) => [i, n.length]).sort((a, b) => b[1] - a[1]).map(([i]) => i);
  const color = new Array<number>(adj.length).fill(-1);
  for (const i of order) {
    const used = new Set(adj[i].map((j) => color[j]));
    let c = 0;
    while (used.has(c)) c++;
    color[i] = c % 5;
  }
  fc.features.forEach((f, i) => {
    f.properties = { ...(f.properties ?? {}), mapcolor: color[i] };
  });
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
  "bosnia and herzegovina": "bosnia and herz",
  "antigua and barbuda": "antigua and barb",
  "marshall islands": "marshall is",
  "solomon islands": "solomon is",
  "north macedonia": "macedonia",
  "saint kitts and nevis": "st kitts and nevis",
  "saint vincent and the grenadines": "st vin and gren",
  "vatican city": "vatican",
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
 * d3-geo reads polygon rings as spherical and needs them clockwise. A ring wound the
 * other way means "the whole globe except this shape" and paints over the entire map
 * (simplification occasionally flips small polygons). Rewind any such polygon in place.
 */
export function fixWinding(fc: FeatureCollection): FeatureCollection {
  for (const f of fc.features) {
    const g = f.geometry;
    if (!g) continue;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    for (const rings of polys) {
      if (geoArea({ type: "Polygon", coordinates: rings }) > 2 * Math.PI) rings.forEach((r) => r.reverse());
    }
  }
  return fc;
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

// ── Subdivisions (provinces / districts), loaded per country on demand ──

type SubdivisionIndex = Record<string, { iso: string; levels: number[] }>;
let subdivisionIndex: Promise<SubdivisionIndex> | null = null;
const subdivisionCache = new Map<string, Promise<FeatureCollection | undefined>>();

function subdivisionIndexOnce(baseUrl: string) {
  subdivisionIndex ??= fetch(`${baseUrl}/geodata/subdivisions/index.json`)
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
  return subdivisionIndex;
}

/** ISO3 code for a country name as used in countries-50m.json ("Dem. Rep. Congo" → "COD"). */
export async function countryIso(countryName: string, baseUrl = ""): Promise<string | undefined> {
  return (await subdivisionIndexOnce(baseUrl))[countryName]?.iso;
}

/** Country name (as in countries-50m.json) for an ISO3 code. */
export async function countryByIso(iso: string, baseUrl = ""): Promise<string | undefined> {
  const idx = await subdivisionIndexOnce(baseUrl);
  return Object.keys(idx).find((name) => idx[name].iso === iso);
}

/**
 * Load a country's ADM1 (provinces/states) or ADM2 (districts) boundaries, built
 * from geoBoundaries by scripts/build-subdivisions.mjs. `countryName` is the name
 * used in countries-50m.json. Resolves undefined when none are bundled.
 */
export function loadSubdivisions(
  countryName: string,
  level: 1 | 2,
  baseUrl = "",
): Promise<FeatureCollection | undefined> {
  const key = `${countryName}|${level}`;
  if (!subdivisionCache.has(key)) {
    subdivisionCache.set(
      key,
      subdivisionIndexOnce(baseUrl).then(async (idx) => {
        const entry = idx[countryName];
        if (!entry?.levels.includes(level)) return undefined;
        const res = await fetch(`${baseUrl}/geodata/subdivisions/${entry.iso}-${level}.json`);
        if (!res.ok) return undefined;
        const topo = await res.json();
        const fc = feature(topo, topo.objects.units) as unknown as FeatureCollection;
        colourNeighbours(fc, topo.objects.units.geometries);
        return fixWinding(fc);
      }).catch(() => undefined),
    );
  }
  return subdivisionCache.get(key)!;
}
