/**
 * Geometry facts the rulebook needs on the server: does a place exist in the
 * boundary data, and is it tall or wide? Uses the same 1:50m world file the maps are drawn from.
 */
import { feature } from "topojson-client";
import { geoBounds, geoCentroid } from "d3-geo";
import type { FeatureCollection } from "geojson";
import world from "world-atlas/countries-50m.json";
import { CONTINENT_BBOX, findCountry, mainParts, normalizeName, type CountryFeature } from "@/lib/cartography/geo";

let fc: FeatureCollection | null = null;
function countries(): FeatureCollection {
  if (!fc) {
    const topo = world as unknown as { objects: { countries: unknown } };
    fc = feature(topo as never, topo.objects.countries as never) as unknown as FeatureCollection;
  }
  return fc;
}

/** The boundary-data feature for a country name (any common spelling), if it exists. */
export function countryFeature(name: string): CountryFeature | undefined {
  return findCountry(countries(), name);
}

export function isKnownRegion(name: string): boolean {
  return Boolean(CONTINENT_BBOX[normalizeName(name)]);
}

/** Height ÷ width of a place on an equal-area-ish view (> 1 is tall). */
export function aspectOf(level: string, region?: string): number | null {
  if (level === "world") return 0.5;
  let box: [number, number, number, number] | undefined;
  if (level === "continent" && region) box = CONTINENT_BBOX[normalizeName(region)];
  else if (region) {
    const f = countryFeature(region);
    if (f) {
      const [[x0, y0], [x1, y1]] = geoBounds(mainParts(f) as never);
      box = [x0, y0, x1 < x0 ? x1 + 360 : x1, y1];
    }
  }
  if (!box) return null;
  const [x0, y0, x1, y1] = box;
  const midLat = ((y0 + y1) / 2) * (Math.PI / 180);
  const w = (x1 - x0) * Math.cos(midLat);
  const h = y1 - y0;
  return w > 0 ? h / w : null;
}

/**
 * The smallest named region that holds every one of these countries ("East Africa"
 * for Kenya, Uganda, Tanzania and Rwanda), or null if they span no single region.
 */
export function regionContaining(names: string[]): string | null {
  const pts = names.map((n) => countryFeature(n)).filter(Boolean).map((f) => geoCentroid(mainParts(f!) as never));
  if (!pts.length) return null;
  let best: { name: string; area: number } | null = null;
  for (const [name, [x0, y0, x1, y1]] of Object.entries(CONTINENT_BBOX)) {
    if (!pts.every(([x, y]) => x >= x0 && x <= x1 && y >= y0 && y <= y1)) continue;
    const area = (x1 - x0) * (y1 - y0);
    if (!best || area < best.area) best = { name, area };
  }
  return best ? best.name.replace(/\b\w/g, (c) => c.toUpperCase()) : null;
}

/** The page orientation whose map frame best matches a place's shape. */
export const PORTRAIT_ABOVE = 0.95;
