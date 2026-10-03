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

/**
 * Find a town by name. Ambiguous names ("San Jose", "Victoria") resolve to the one
 * in the preferred country if there is one, else the most important.
 */
export function geocode(g: Gazetteer, name: string, preferIso?: string): GazetteerPlace | undefined {
  const tries = [normalizeName(name), ...keysFor(name)];
  // "Kitwe Central Clinic", "Ndola depot": fall back to the leading words.
  const words = normalizeName(name).split(" ");
  for (let n = words.length - 1; n >= 1; n--) tries.push(words.slice(0, n).join(" "));
  for (const key of tries) {
    const hits = g.byName.get(key);
    if (!hits?.length) continue;
    const local = preferIso ? hits.filter((h) => h[6] === preferIso) : [];
    const pool = local.length ? local : preferIso && key !== tries[0] ? [] : hits;
    if (!pool.length) continue;
    return [...pool].sort((a, b) => b[5] - a[5] || a[4] - b[4] || b[3] - a[3])[0];
  }
  return undefined;
}
