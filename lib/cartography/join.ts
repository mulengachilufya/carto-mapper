import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { GeoLevel } from "@/lib/mapspec/schema";
import { buildNameIndex, matchFeature, normalizeName, type CountryFeature } from "@/lib/cartography/geo";

/** Provinces/states (ADM1) and districts (ADM2) of the country a map is about. */
export interface Subdivisions {
  adm1?: FeatureCollection;
  adm2?: FeatureCollection;
}

export type JoinLevel = "country" | "adm1" | "adm2";

export interface RegionJoin {
  level: JoinLevel;
  /** Features a place name can join to at this level. */
  features: CountryFeature[];
  /** The feature a user's place name refers to, if any. */
  match: (name: string) => CountryFeature | undefined;
  /** Stable key for a matched feature (for value lookups). */
  keyOf: (f: CountryFeature) => string;
}

// Words people add to subdivision names that the boundary data usually omits.
const GENERIC = /\b(province|provincia|region|state|district|county|city|governorate|prefecture|municipality|department|division|oblast|of)\b/g;
const strip = (n: string) => n.replace(GENERIC, " ").replace(/\s+/g, " ").trim();

/** Name matcher for a set of provinces/districts (tolerates "Province", "State", hyphens…). */
export function subdivisionMatcher(fc: FeatureCollection) {
  return subdivisionIndex(fc);
}

function subdivisionIndex(fc: FeatureCollection) {
  const exact = new Map<string, CountryFeature>();
  const loose = new Map<string, CountryFeature | null>(); // null = ambiguous
  for (const f of fc.features as CountryFeature[]) {
    const n = normalizeName(f.properties?.name ?? "");
    if (!n) continue;
    if (!exact.has(n)) exact.set(n, f);
    const s = strip(n);
    if (s) loose.set(s, loose.has(s) && loose.get(s) !== f ? null : f);
  }
  return (name: string): CountryFeature | undefined => {
    const n = normalizeName(name);
    if (!n) return undefined;
    return exact.get(n) ?? loose.get(strip(n)) ?? undefined;
  };
}

/**
 * Decide which boundary set a table's place names refer to, countries, provinces
 * or districts, by how many names actually match, honouring the spec's level when
 * it has matches. A province table on a "country" map therefore still shades the
 * provinces instead of rendering an all-"No data" map.
 */
export function chooseJoin(
  names: string[],
  geo: FeatureCollection,
  subdivisions: Subdivisions | undefined,
  level: GeoLevel,
): RegionJoin {
  const countryIndex = buildNameIndex(geo);
  const candidates: RegionJoin[] = [
    {
      level: "country",
      features: geo.features as CountryFeature[],
      match: (n) => matchFeature(n, countryIndex),
      keyOf: (f) => `c:${normalizeName(f.properties.name)}`,
    },
  ];
  for (const lvl of ["adm1", "adm2"] as const) {
    const fc = subdivisions?.[lvl];
    if (!fc?.features.length) continue;
    const match = subdivisionIndex(fc);
    const keys = new Map<Feature<Geometry>, string>();
    (fc.features as CountryFeature[]).forEach((f, i) => keys.set(f, `${lvl}:${i}`));
    candidates.push({ level: lvl, features: fc.features as CountryFeature[], match, keyOf: (f) => keys.get(f) ?? "" });
  }

  const unique = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
  const scored = candidates.map((c) => ({ c, hits: unique.filter((n) => c.match(n)).length }));
  const preferred = level === "admin1" ? "adm1" : level === "admin2" ? "adm2" : null;
  const pref = scored.find((s) => s.c.level === preferred && s.hits > 0);
  if (pref) return pref.c;
  // Most matches wins; ties go to the coarser level (country, then provinces).
  return scored.reduce((best, s) => (s.hits > best.hits ? s : best)).c;
}
