import { feature } from "topojson-client";
import type { FeatureCollection } from "geojson";
import { fixWinding } from "@/lib/cartography/geo";

/** Natural Earth reference layers for atlas-style maps (built by scripts/build-atlas-layers.mjs). */
export interface AtlasLayers {
  rivers: FeatureCollection; // properties: { rank: number, name: string | null }
  lakes: FeatureCollection; // properties: { rank: number, name: string | null }
  /** [name, lon, lat, population, rank, kind (2 national capital, 1 provincial, 0 town), iso3] */
  places: [string, number, number, number, number, 0 | 1 | 2, string][];
  /** [name, lon, lat, rank, kind ("ocean" | "sea" | "bay" | …)] */
  marine: [string, number, number, number, string][];
  /** [name, lon, lat, elevation m, rank] */
  peaks: [string, number, number, number, number][];
  /** [name, lon, lat, rank, kind ("desert" | "plateau" | "range/mtn" | …)] */
  regions: [string, number, number, number, string][];
}

let pending: Promise<AtlasLayers | null> | null = null;

/** Load (once) and cache the atlas layers. Resolves null if they can't be fetched. */
export function loadAtlasLayers(baseUrl = ""): Promise<AtlasLayers | null> {
  pending ??= (async () => {
    const get = (f: string) => fetch(`${baseUrl}/geodata/atlas/${f}.json`).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
    const [rivers, lakes, places, marine, peaks, regions] = await Promise.all(
      ["rivers", "lakes", "places", "marine", "peaks", "regions"].map(get),
    );
    return {
      rivers: feature(rivers, rivers.objects.rivers) as unknown as FeatureCollection,
      lakes: fixWinding(feature(lakes, lakes.objects.lakes) as unknown as FeatureCollection),
      places,
      marine,
      peaks,
      regions,
    };
  })().catch(() => {
    pending = null;
    return null;
  });
  return pending;
}
