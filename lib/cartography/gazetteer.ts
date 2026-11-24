import { normalizeName } from "@/lib/cartography/geo";

/** [name, lon, lat, population, rank, kind (2 national capital, 1 provincial, 0 town), iso3] */
export type GazetteerPlace = [string, number, number, number, number, 0 | 1 | 2, string];

export interface Gazetteer {
  byName: Map<string, GazetteerPlace[]>;
}

let pending: Promise<Gazetteer | null> | null = null;

/** The Natural Earth populated places (built into public/geodata/atlas/places.json). */
export function loadGazetteer(baseUrl = ""): Promise<Gazetteer | null> {
  pending ??= fetch(`${baseUrl}/geodata/atlas/places.json`)
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((places: GazetteerPlace[]) => {
      const byName = new Map<string, GazetteerPlace[]>();
      for (const p of places) {
        for (const key of keysFor(p[0])) {
          if (!byName.has(key)) byName.set(key, []);
          byName.get(key)!.push(p);
        }
      }
      return { byName };
    })
    .catch(() => {
      pending = null;
      return null;
    });
  return pending;
}

function keysFor(name: string): string[] {
  const n = normalizeName(name);
  const stripped = n.replace(/\b(city|town|municipality|of)\b/g, " ").replace(/\s+/g, " ").trim();
  return stripped && stripped !== n ? [n, stripped] : [n];
}

/** Match the name of a populated place. Leave ambiguous and approximate matches unresolved. */
export function geocode(g: Gazetteer, name: string, preferIso?: string): GazetteerPlace | undefined {
  for (const key of keysFor(name)) {
    const hits = g.byName.get(key)?.filter((place) => !preferIso || place[6] === preferIso);
    if (hits?.length) return hits.length === 1 ? hits[0] : undefined;
  }
  return undefined;
}
