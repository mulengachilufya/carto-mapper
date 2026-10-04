import { geoBounds, geoCentroid, geoContains } from "d3-geo";
import type { Feature, FeatureCollection } from "geojson";
import type { GeoLevel } from "@/lib/mapspec/schema";
import type { ColumnRoles, ParsedTable, Row } from "@/lib/data/parse";
import {
  buildNameIndex,
  CONTINENT_BBOX,
  countryByIso,
  countryIso,
  findCountry,
  loadSubdivisions,
  matchFeature,
  type CountryFeature,
} from "@/lib/cartography/geo";
import { subdivisionMatcher } from "@/lib/cartography/join";
import { geocode, loadGazetteer } from "@/lib/cartography/gazetteer";
import { detectPlace } from "@/lib/mapspec/generate";

export type PlaceKind = "countries" | "provinces" | "districts" | "towns" | "coordinates";

export interface Reading {
  kind: PlaceKind;
  matched: number;
  total: number;
  /** For sub-national readings: the country (countries-50m name). */
  country?: string;
}

export interface Resolution {
  reading: Reading;
  /** Other ways to read the same names, with how many each matched. */
  alternatives: Reading[];
  unmatched: string[];
  rowMatched: boolean[];
  /** The map geography this data implies. */
  level: GeoLevel;
  region?: string;
  /** Table and roles, with Latitude/Longitude added when towns were geocoded. */
  table: ParsedTable;
  roles: ColumnRoles;
}

const KIND_LEVEL: Record<Exclude<PlaceKind, "coordinates" | "towns">, GeoLevel> = {
  countries: "world",
  provinces: "admin1",
  districts: "admin2",
};

/**
 * Work out what a table's places are, countries, provinces, districts, towns or
 * coordinates, and where in the world they are, so the map can be drawn at the
 * right level without the user having to say. Towns are geocoded from the gazetteer.
 */
export async function resolvePlaces(
  table: ParsedTable,
  roles: ColumnRoles,
  ctx: { geo: FeatureCollection; prompt?: string; prefer?: PlaceKind },
): Promise<Resolution | null> {
  const { geo } = ctx;

  // ── Coordinates: nothing to match, just find where they are. ──
  if (roles.latField && roles.lonField) {
    const pts = table.rows.map((r) => [Number(r[roles.lonField!]), Number(r[roles.latField!])] as [number, number]);
    const ok = pts.map(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && Math.abs(y) <= 90 && Math.abs(x) <= 180);
    const where = locate(geo, pts.filter((_, i) => ok[i]));
    return {
      reading: { kind: "coordinates", matched: ok.filter(Boolean).length, total: pts.length, country: where.country },
      alternatives: [],
      unmatched: table.rows.filter((_, i) => !ok[i]).map((r) => String(r[roles.nameField ?? ""] ?? "(no coordinates)")),
      rowMatched: ok,
      level: where.level,
      region: where.region,
      table,
      roles,
    };
  }

  const field = roles.nameField;
  if (!field) return null;
  const names = table.rows.map((r) => String(r[field] ?? "").trim());
  const unique = Array.from(new Set(names.filter(Boolean)));
  if (!unique.length) return null;

  // Countries
  const countryIndex = buildNameIndex(geo);
  const countryHits = unique.filter((n) => matchFeature(n, countryIndex));

  // Which country are sub-national names in? The prompt says, or the towns vote.
  const gaz = await loadGazetteer();
  let candidate: string | undefined;
  const fromPrompt = ctx.prompt ? detectPlace(ctx.prompt) : {};
  if (fromPrompt.level === "country" && fromPrompt.region) candidate = findCountry(geo, fromPrompt.region)?.properties.name;
  if (!candidate && gaz) {
    const votes = new Map<string, number>();
    for (const n of unique) {
      const p = geocode(gaz, n);
      if (p) votes.set(p[6], (votes.get(p[6]) ?? 0) + 1);
    }
    const top = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= Math.max(2, unique.length * 0.3)) candidate = await countryByIso(top[0]);
  }
  const iso = candidate ? await countryIso(candidate) : undefined;

  // Provinces and districts of that country
  const [adm1, adm2] = candidate
    ? await Promise.all([loadSubdivisions(candidate, 1), loadSubdivisions(candidate, 2)])
    : [undefined, undefined];
  const m1 = adm1 ? subdivisionMatcher(adm1) : null;
  const m2 = adm2 ? subdivisionMatcher(adm2) : null;
  const provinceHits = m1 ? unique.filter((n) => m1(n)) : [];
  const districtHits = m2 ? unique.filter((n) => m2(n)) : [];

  // Towns
  const townOf = new Map<string, [number, number]>();
  if (gaz) {
    for (const n of unique) {
      const p = geocode(gaz, n, iso);
      if (p) townOf.set(n, [p[1], p[2]]);
    }
  }

  const readings: Reading[] = [
    { kind: "countries" as const, matched: countryHits.length, total: unique.length },
    { kind: "provinces" as const, matched: provinceHits.length, total: unique.length, country: candidate },
    { kind: "districts" as const, matched: districtHits.length, total: unique.length, country: candidate },
    { kind: "towns" as const, matched: townOf.size, total: unique.length, country: candidate },
  ].filter((r) => r.matched > 0 || r.kind === "countries");

  // Best reading: the user's choice, else most matches. Ties go countries → provinces →
  // towns → districts: many districts share their town's name, and a list of places
  // more often means sites than district boundaries.
  const order: PlaceKind[] = ["countries", "provinces", "towns", "districts"];
  const reading =
    readings.find((r) => r.kind === ctx.prefer && r.matched > 0) ??
    [...readings].sort((a, b) => b.matched - a.matched || order.indexOf(a.kind) - order.indexOf(b.kind))[0];
  const matchedSet = new Set(
    reading.kind === "countries" ? countryHits : reading.kind === "provinces" ? provinceHits : reading.kind === "districts" ? districtHits : [...townOf.keys()],
  );
  const rowMatched = names.map((n) => matchedSet.has(n));
  const unmatched = unique.filter((n) => !matchedSet.has(n));

  let outTable = table;
  let outRoles = roles;
  let level: GeoLevel;
  let region: string | undefined;

  if (reading.kind === "towns") {
    // Geocode: add coordinates so the map places each town exactly.
    const rows: Row[] = table.rows.map((r) => {
      const c = townOf.get(String(r[field] ?? "").trim());
      return { ...r, Latitude: c ? c[1] : null, Longitude: c ? c[0] : null };
    });
    outTable = { columns: [...table.columns.filter((c) => c !== "Latitude" && c !== "Longitude"), "Latitude", "Longitude"], rows, rowCount: rows.length };
    outRoles = { ...roles, latField: "Latitude", lonField: "Longitude" };
    const where = locate(geo, [...townOf.values()]);
    level = where.level;
    region = where.region;
  } else if (reading.kind === "countries") {
    const feats = countryHits.map((n) => matchFeature(n, countryIndex)!).filter(Boolean);
    const cont = continentOf(feats);
    level = cont ? "continent" : "world";
    region = cont ?? "World";
  } else {
    level = KIND_LEVEL[reading.kind as "provinces" | "districts"];
    region = candidate;
  }

  return {
    reading,
    alternatives: readings.filter((r) => r !== reading && r.matched > 0),
    unmatched,
    rowMatched,
    level,
    region,
    table: outTable,
    roles: outRoles,
  };
}

/** Where a set of points is: one country, else the region around them. */
function locate(geo: FeatureCollection, pts: [number, number][]): { level: GeoLevel; region?: string; country?: string } {
  if (!pts.length) return { level: "world", region: "World" };
  const sample = pts.length > 300 ? pts.filter((_, i) => i % Math.ceil(pts.length / 300) === 0) : pts;
  const counts = new Map<CountryFeature, number>();
  const feats = (geo.features as CountryFeature[]).map((f) => ({ f, b: geoBounds(f as unknown as Feature) }));
  for (const p of sample) {
    const hit = feats.find(({ f, b: [[w, s], [e, n]] }) => {
      const inBox = (w <= e ? p[0] >= w && p[0] <= e : p[0] >= w || p[0] <= e) && p[1] >= s && p[1] <= n;
      return inBox && geoContains(f as unknown as Feature, p);
    });
    if (hit) counts.set(hit.f, (counts.get(hit.f) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= sample.length * 0.8) return { level: "country", region: top[0].properties.name, country: top[0].properties.name };
  // Spread across countries: frame the points themselves (continent-style projection).
  return { level: "continent", region: undefined };
}

/** The smallest named continent/region box holding every country's centroid. */
function continentOf(feats: CountryFeature[]): string | undefined {
  if (feats.length < 2) return undefined;
  const cs = feats.map((f) => geoCentroid(f as unknown as Feature));
  const fits = Object.entries(CONTINENT_BBOX)
    .filter(([, [w, s, e, n]]) => cs.every(([x, y]) => x >= w && x <= e && y >= s && y <= n))
    .sort((a, b) => (a[1][2] - a[1][0]) * (a[1][3] - a[1][1]) - (b[1][2] - b[1][0]) * (b[1][3] - b[1][1]));
  return fits[0]?.[0].replace(/\b\w/g, (c) => c.toUpperCase());
}

// Capitalised words that start sentences or name things but are rarely places.
const STOP = new Set(
  "a an and the in on at of for to we our us it its this that these those they their he she i you your by from with as is are was were be been has have had but or not new old north south east west central northern southern eastern western january february march april may june july august september october november december monday tuesday wednesday thursday friday saturday sunday".split(
    " ",
  ),
);

/**
 * Pull the places out of a paragraph: "In 2025 we ran clinics in Accra, Kumasi and
 * Tamale" → ["Accra", "Kumasi", "Tamale"]. Tries the longest capitalised phrase first
 * ("Cape Coast" before "Cape"), against countries and the gazetteer.
 */
export async function placesInProse(text: string, geo: FeatureCollection): Promise<string[]> {
  const gaz = await loadGazetteer();
  const countryIndex = buildNameIndex(geo);
  const isPlace = (phrase: string) =>
    !STOP.has(phrase.toLowerCase()) && (Boolean(matchFeature(phrase, countryIndex)) || Boolean(gaz?.byName.has(phrase.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim())));
  const found: string[] = [];
  const phraseRe = /\p{Lu}[\p{L}'’.-]*(?:\s+(?:of|de|del|da|es|el|la|le|the|du|al)?\s*\p{Lu}[\p{L}'’.-]*){0,3}/gu;
  for (const m of text.matchAll(phraseRe)) {
    const words = m[0].split(/\s+/);
    for (let start = 0; start < words.length; start++) {
      for (let end = words.length; end > start; end--) {
        const phrase = words.slice(start, end).join(" ").replace(/[.’']+$/, "");
        if (isPlace(phrase)) {
          if (!found.includes(phrase)) found.push(phrase);
          start = end - 1;
          break;
        }
      }
    }
  }
  return found;
}
