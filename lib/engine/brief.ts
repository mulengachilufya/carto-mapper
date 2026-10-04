/**
 * Step 1 of the engine: read the brief. Turns a sentence like "Provinces of Zambia"
 * or "rainfall by district in Malawi for a donor report" into facts the rulebook can
 * act on, where, at what level, about what, and what kind of map. Deterministic:
 * the same words always give the same reading.
 */
import { COUNTRIES } from "@/lib/profile-options";
import { normalizeName } from "@/lib/cartography/geo";
import type { MapStyle } from "@/lib/mapspec/schema";
import {
  ADM1_NAME,
  COLOUR_WORDS,
  REGIONS,
  STYLE_WORDS,
  THEMES,
  UNIT_WORDS,
  WORD_IS_ADM1,
  WORLD_WORDS,
  type Theme,
  type UnitLevel,
} from "./vocabulary";

export type Intent = "reference" | "thematic" | "locations" | "footprint";

export interface Brief {
  text: string;
  place: { name: string; kind: "world" | "region" | "country" } | null;
  /** Every country named in the brief, in order ("Kenya, Uganda and Tanzania"). */
  countries: string[];
  /** The units the map is about ("provinces", "districts", "countries", sites). */
  units: { level: UnitLevel; singular: string; plural: string } | null;
  theme: Theme | null;
  intent: Intent;
  style: MapStyle | null;
  palette: string | null;
  year: string | null;
  orientation: "portrait" | "landscape" | null;
  /** The user asked for a map with no data behind it ("illustrative", "sample"). */
  illustrative: boolean;
}

// Common ways of naming countries that aren't the list's own spelling.
const COUNTRY_ALIASES: Record<string, string> = {
  usa: "United States", "u s": "United States", "u s a": "United States", america: "United States",
  "united states of america": "United States", us: "United States", uk: "United Kingdom", britain: "United Kingdom",
  "great britain": "United Kingdom", england: "United Kingdom", drc: "Congo (Kinshasa)", "dr congo": "Congo (Kinshasa)",
  "democratic republic of the congo": "Congo (Kinshasa)", "congo brazzaville": "Congo (Brazzaville)",
  "republic of the congo": "Congo (Brazzaville)", "ivory coast": "Côte d'Ivoire", "cote d ivoire": "Côte d'Ivoire",
  burma: "Myanmar", swaziland: "Eswatini", "czech republic": "Czechia", holland: "Netherlands", uae: "United Arab Emirates",
  "south korea": "South Korea", korea: "South Korea", "north korea": "North Korea", russia: "Russia", "cape verde": "Cabo Verde",
};

const NAMES: { norm: string; name: string }[] = [
  ...COUNTRIES.map((c) => ({ norm: normalizeName(c), name: c })),
  ...Object.entries(COUNTRY_ALIASES).map(([a, c]) => ({ norm: a, name: c })),
  // Longest first, so "south sudan" wins over "sudan" and "niger" can't match inside "nigeria".
].sort((a, b) => b.norm.length - a.norm.length);

/** How a country reads in a title (the list's spellings are for pickers). */
const DISPLAY: Record<string, string> = {
  "Congo (Kinshasa)": "DR Congo",
  "Congo (Brazzaville)": "Republic of the Congo",
};
export const displayCountry = (c: string) => DISPLAY[c] ?? c;

/** Every country named in the text, in reading order. */
function countriesIn(text: string, norm: string): string[] {
  let padded = ` ${norm} `;
  const found: { name: string; at: number }[] = [];
  for (const n of NAMES) {
    // "us" is a pronoun in prose, only the capitalised abbreviation counts.
    if (n.norm === "us") continue;
    const at = padded.indexOf(` ${n.norm} `);
    if (at < 0) continue;
    if (!found.some((f) => f.name === n.name)) found.push({ name: n.name, at });
    // Blank it out so "niger" can't be found again inside what "nigeria" already took.
    padded = padded.replace(` ${n.norm} `, ` ${"#".repeat(n.norm.length)} `);
  }
  if (/\bU\.?S\.?\b/.test(text) && !found.some((f) => f.name === "United States")) found.push({ name: "United States", at: text.search(/\bU\.?S\.?\b/) });
  return found.sort((a, b) => a.at - b.at).map((f) => f.name);
}

export function readBrief(text: string, opts: { hasData?: boolean } = {}): Brief {
  const t = text.toLowerCase();
  const norm = normalizeName(text);

  // Where
  const countries = countriesIn(text, norm);
  const country = countries.length === 1 ? countries[0] : null;
  let place: Brief["place"] = null;
  if (country) place = { name: displayCountry(country), kind: "country" };
  else {
    const region = REGIONS.find((r) => r.re.test(t));
    if (region) place = { name: region.name, kind: "region" };
    else if (WORLD_WORDS.test(t) || countries.length > 1) place = { name: "World", kind: "world" };
  }

  // Which units. "Provinces of Zambia" → Zambia's first level, named as Zambians do.
  let units: Brief["units"] = null;
  const word = UNIT_WORDS.find((u) => u.re.test(t));
  if (word) {
    let level = word.level;
    const cn = country ? normalizeName(country) : "";
    // A country's first-level units can carry the word a user says (Kenya's counties, Botswana's districts).
    if (level === "admin2" && cn && WORD_IS_ADM1[cn]?.[0] === word.singular) level = "admin1";
    // "County"/"district" in a country with no second level named so → still second level.
    units = { level, singular: word.singular, plural: word.plural };
    if (level === "admin1" && cn && ADM1_NAME[cn]) units = { level, singular: ADM1_NAME[cn][0], plural: ADM1_NAME[cn][1] };
    // "national" / "country" inside one named country means the country itself, not "countries".
    if (level === "countries" && place?.kind === "country") units = null;
  }

  const theme = THEMES.find((th) => th.re.test(t))?.theme ?? null;
  const style = STYLE_WORDS.find((s) => s.re.test(t))?.style ?? theme?.style ?? null;
  const palette = COLOUR_WORDS.find((c) => c.re.test(t))?.palette ?? null;
  const ym = t.match(/\b(since )?(19[5-9]\d|20[0-4]\d)\b/);
  // "since 1990" is a baseline, not the date of the data.
  const year = ym ? (ym[1] ? `Since ${ym[2]}` : ym[2]) : null;
  const orientation = /\bportrait\b|\btall\b|\bvertical\b/.test(t) ? "portrait" : /\blandscape\b|\bwide\b|\bslide\b|\bpresentation\b|\bdeck\b/.test(t) ? "landscape" : null;
  const illustrative = /\billustrative\b|\bsample data\b|\bexample data\b|\bdummy\b|\bfake data\b/.test(t);

  // What kind of map
  let intent: Intent;
  if (/where we work|our presence|countries we|operate in|our footprint|member states|highlight/.test(t)) intent = "footprint";
  else if (units?.level === "points" && !theme) intent = "locations";
  else if (theme && theme.id !== "physical") intent = "thematic";
  else if (opts.hasData) intent = "thematic";
  else intent = "reference";

  // Several countries named: that list is the data ("where we work: Kenya, Uganda, Tanzania").
  if (countries.length > 1 && intent === "reference") intent = "footprint";

  return { text, place, countries: countries.map(displayCountry), units, theme, intent, style, palette, year, orientation, illustrative };
}

/** "Provinces of Zambia", how an atlas names a reference plate. */
export function referenceTitle(b: Brief): string | null {
  if (!b.place) return null;
  if (b.units && b.units.level !== "points" && b.units.level !== "countries" && b.place.kind === "country")
    return `${b.units.plural} of ${b.place.name}`;
  if (b.place.kind === "region" || b.place.kind === "world") {
    const physical = b.style === "atlas" && /physical|relief|terrain/.test(b.text.toLowerCase());
    return `${b.place.name === "World" ? "The World" : b.place.name}${physical ? ": Physical" : ": Political"}`;
  }
  if (b.style === "atlas" && /physical|relief|terrain/.test(b.text.toLowerCase())) return `${b.place.name}: Physical`;
  return b.place.name;
}
