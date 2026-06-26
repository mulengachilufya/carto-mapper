import { readFile } from "fs/promises";
import path from "path";
import { feature } from "topojson-client";
import type { FeatureCollection } from "geojson";

let cache: FeatureCollection | null = null;

/** Load countries TopoJSON from the filesystem (for server-side rendering / PDF). */
export async function loadCountriesServer(detail: "110m" | "50m" = "50m"): Promise<FeatureCollection> {
  if (cache) return cache;
  const file = path.join(process.cwd(), "public", "geodata", `countries-${detail}.json`);
  const topo = JSON.parse(await readFile(file, "utf8"));
  const fc = feature(topo, topo.objects.countries) as unknown as FeatureCollection;
  cache = fc;
  return fc;
}
