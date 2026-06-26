import { type MapSpec, type MapType, type GeoLevel, type PaletteKind, parseMapSpec } from "./schema";
import type { ColumnRoles, ParsedTable } from "@/lib/data/parse";
import { getIndustry } from "@/lib/industries";
import { paletteKind } from "@/lib/cartography/palettes";

export interface GenerateInput {
  industry: string;
  customIndustry?: string;
  answers: Record<string, string>;
  vibe?: string;
  table?: ParsedTable | null;
  roles?: ColumnRoles;
  outputOptions?: Partial<MapSpec["furniture"]>;
}

// ─── Place detection (lightweight gazetteer) ─────────────────
const CONTINENTS = [
  "africa", "europe", "asia", "north america", "south america", "oceania",
  "middle east", "east africa", "west africa", "southern africa", "central africa",
  "latin america", "the world", "world", "global", "worldwide",
];

const COUNTRIES = [
  "zambia", "zimbabwe", "malawi", "mozambique", "tanzania", "kenya", "uganda",
  "rwanda", "burundi", "ethiopia", "somalia", "south sudan", "sudan", "nigeria",
  "ghana", "senegal", "mali", "niger", "chad", "cameroon", "angola", "namibia",
  "botswana", "south africa", "lesotho", "eswatini", "madagascar", "egypt",
  "morocco", "algeria", "tunisia", "libya", "ivory coast", "liberia",
  "sierra leone", "democratic republic of the congo", "dr congo", "congo",
  "united states", "usa", "canada", "mexico", "brazil", "argentina", "chile",
  "colombia", "peru", "united kingdom", "uk", "france", "germany", "spain",
  "italy", "portugal", "netherlands", "belgium", "sweden", "norway", "poland",
  "india", "pakistan", "bangladesh", "china", "japan", "indonesia", "philippines",
  "vietnam", "thailand", "malaysia", "australia", "new zealand", "saudi arabia",
  "turkey", "iran", "iraq", "afghanistan", "ukraine", "russia",
];

export function detectPlace(vibe: string): { region?: string; level?: GeoLevel } {
  const t = ` ${vibe.toLowerCase()} `;
  for (const c of COUNTRIES) {
    if (t.includes(` ${c} `) || t.includes(` ${c},`) || t.includes(` ${c}.`)) {
      return { region: titleCase(c), level: "country" };
    }
  }
  for (const c of CONTINENTS) {
    if (t.includes(c)) {
      if (["world", "the world", "global", "worldwide"].includes(c)) return { region: "World", level: "world" };
      return { region: titleCase(c), level: "continent" };
    }
  }
  return {};
}

// ─── Industry palette flavour (sequential base) ──────────────
const INDUSTRY_PALETTE: Record<string, string> = {
  healthcare: "BuGn",
  public_health: "YlGnBu",
  ngo: "YlGnBu",
  wash: "GnBu",
  education: "PuBu",
  sports: "Greens",
  arts: "Purples",
  government: "Blues",
  environment: "YlGn",
  agriculture: "YlGn",
  realestate: "BuPu",
  tourism: "OrRd",
  emergency: "YlOrRd",
  mining: "YlOrBr",
  transport: "PuBu",
  energy: "YlOrBr",
  journalism: "Blues",
  research: "Blues",
  faith: "BuPu",
  social_services: "PuBuGn",
  finance: "BuPu",
  construction: "Oranges",
  retail: "PuRd",
  custom: "Blues",
};

// ─── Main generator ──────────────────────────────────────────
export function generateMapSpecHeuristic(input: GenerateInput): MapSpec {
  const { industry, answers, roles = {}, table } = input;
  const vibe = input.vibe ?? "";
  const ind = getIndustry(industry);

  const hasCoords = Boolean(roles.latField && roles.lonField);
  const hasValue = Boolean(roles.valueField);
  const hasName = Boolean(roles.nameField);
  const hasCategory = Boolean(roles.categoryField);
  const show = (answers.show_what ?? "").toLowerCase();

  const mapType = decideMapType({ show, hasCoords, hasValue, hasName, hasCategory });

  // Geography
  const place = detectPlace(vibe);
  const scope = answers.geographic_scope ?? "";
  let level: GeoLevel = place.level ?? scopeToLevel(scope, mapType);
  // If data is multi-country names, prefer a world/continent thematic map.
  if (!hasCoords && hasName && looksMultiCountry(table, roles) && level === "country") {
    level = place.region && place.level === "continent" ? "continent" : "world";
  }
  const region = place.region ?? (level === "world" ? "World" : undefined);

  // Symbology
  const wantsChange = /change|impact|trend|swing|before|loss|gain/.test(show);
  const isCategorical = mapType === "categorical_point";
  const paletteKind: PaletteKind = isCategorical ? "qualitative" : wantsChange ? "diverging" : "sequential";
  const palette =
    paletteKind === "qualitative" ? "Set2" : paletteKind === "diverging" ? "RdBu" : INDUSTRY_PALETTE[industry] ?? "Blues";

  // Text
  const subjectLabel = labelForFirstAnswer(ind?.id, answers);
  const metricLabel = roles.valueField ? humanize(roles.valueField) : undefined;
  const title = buildTitle({ mapType, subjectLabel, metricLabel, region, level });
  const subtitle = buildSubtitle(answers, ind?.name);

  // Page
  const page = pageForOutput(answers.output_use ?? "");

  // Furniture conventions
  const furniture = {
    title: true,
    legend: true,
    source: true,
    caption: false,
    scalebar: level !== "world" && level !== "continent",
    north_arrow: level !== "world",
    graticule: level === "world" || level === "continent",
    ...(input.outputOptions ?? {}),
  };

  const valueFormat = guessFormat(roles.valueField);

  const spec: Partial<MapSpec> = {
    version: 1,
    title,
    subtitle,
    caption: subtitle,
    source: "Source: your data · Boundaries © Natural Earth",
    mapType,
    geography: { level, region, projectionHint: undefined },
    data: {
      nameField: roles.nameField,
      valueField: roles.valueField,
      categoryField: roles.categoryField,
      latField: roles.latField,
      lonField: roles.lonField,
      valueLabel: metricLabel,
      valueFormat,
    },
    symbology: {
      palette,
      paletteKind,
      classes: 5,
      classification: "quantile",
      reverse: false,
      minRadius: 2,
      maxRadius: 26,
    },
    furniture,
    page,
    notes: "Generated by the CartoMapper cartographic rules engine.",
  };

  return parseMapSpec(spec);
}

// ─── Helpers ─────────────────────────────────────────────────
function decideMapType(o: {
  show: string;
  hasCoords: boolean;
  hasValue: boolean;
  hasName: boolean;
  hasCategory: boolean;
}): MapType {
  const { show, hasCoords, hasValue, hasName, hasCategory } = o;
  const wantsLocations = /location|site|venue|where|present/.test(show);
  const wantsCounts = /count|magnitude|beneficiar|caseload|volume|number/.test(show);
  const wantsCategories = /categor|class|who won|status/.test(show);

  if (hasCoords) {
    if (wantsCategories || (hasCategory && wantsLocations)) return "categorical_point";
    if (hasValue && !wantsLocations) return "proportional_symbol";
    if (hasValue && wantsCounts) return "proportional_symbol";
    return hasCategory ? "categorical_point" : "point";
  }
  if (hasName && hasValue) return "choropleth";
  if (hasName) return hasCategory ? "categorical_point" : "point";
  return "choropleth";
}

function scopeToLevel(scope: string, mapType: MapType): GeoLevel {
  switch (scope) {
    case "global":
      return "world";
    case "national":
      return "country";
    case "province":
      return mapType === "choropleth" ? "admin1" : "country";
    case "district":
      return mapType === "choropleth" ? "admin2" : "country";
    case "local":
    case "neighbourhood":
      return "country";
    case "city":
      return "city";
    case "subnational":
      return "continent";
    default:
      return "world";
  }
}

function looksMultiCountry(table?: ParsedTable | null, roles?: ColumnRoles): boolean {
  if (!table || !roles?.nameField) return false;
  const names = table.rows
    .map((r) => String(r[roles.nameField!] ?? "").toLowerCase().trim())
    .filter(Boolean);
  const set = new Set(names);
  let hits = 0;
  for (const c of COUNTRIES) if (set.has(c)) hits++;
  return hits >= 3 || set.size >= 8;
}

function pageForOutput(output: string): MapSpec["page"] {
  if (output === "poster") return { size: "A4", orientation: "portrait" };
  if (["annual_report", "report", "donor_report", "policy", "proposal", "academic", "thesis"].includes(output))
    return { size: "A4", orientation: "portrait" };
  return { size: "A4", orientation: "landscape" };
}

function labelForFirstAnswer(industryId?: string, answers: Record<string, string> = {}): string {
  const ind = industryId ? getIndustry(industryId) : undefined;
  if (!ind) return "Features";
  const q = ind.questions[0];
  const val = answers[q.id];
  const opt = q.options.find((o) => o.value === val);
  return opt?.label ?? "Features";
}

function buildTitle(o: {
  mapType: MapType;
  subjectLabel: string;
  metricLabel?: string;
  region?: string;
  level: GeoLevel;
}): string {
  const where = o.region ? ` in ${o.region}` : o.level === "world" ? " by Country" : "";
  if (o.mapType === "choropleth") {
    const generic = !o.metricLabel || /^(value|count|number|metric|amount|total)$/i.test(o.metricLabel);
    const what = generic ? cleanSubject(o.subjectLabel) : o.metricLabel;
    return o.level === "world" ? `${what} by Country` : `${what}${where || ""}`.trim();
  }
  return `${cleanSubject(o.subjectLabel)}${where}`.trim();
}

function buildSubtitle(answers: Record<string, string>, industryName?: string): string {
  const parts: string[] = [];
  if (industryName) parts.push(industryName);
  return parts.join(" · ");
}

function cleanSubject(label: string): string {
  // "Primary clinics / health posts" → "Primary clinics"
  return label.split("/")[0].split("(")[0].trim();
}

function humanize(header: string): string {
  return header
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function guessFormat(valueField?: string): string {
  if (!valueField) return ",";
  const h = valueField.toLowerCase();
  if (/pct|percent|rate|%/.test(h)) return ".0%";
  if (/\$|usd|price|cost|revenue|sales|income|gdp/.test(h)) return "$,";
  return ",";
}

// ─── Revision (keyword fallback when Claude is unavailable) ──
const COLOR_TO_PALETTE: Record<string, string> = {
  blue: "Blues",
  green: "Greens",
  red: "Reds",
  purple: "Purples",
  orange: "Oranges",
  grey: "Greys",
  gray: "Greys",
  teal: "BuGn",
  yellow: "YlOrBr",
  pink: "RdPu",
};

export function applyRevisionHeuristic(prev: MapSpec, request: string): MapSpec {
  const t = request.toLowerCase();
  const next = parseMapSpec(prev);

  const removing = /(remove|hide|without|no |turn off|drop|don't|dont)/.test(t);
  const adding = /(add|show|include|turn on|with )/.test(t);
  const furnitureWords: [RegExp, keyof MapSpec["furniture"]][] = [
    [/legend/, "legend"],
    [/scale ?bar/, "scalebar"],
    [/north/, "north_arrow"],
    [/title/, "title"],
    [/graticule|grid|lat.*lon/, "graticule"],
    [/caption/, "caption"],
    [/source|credit/, "source"],
  ];
  for (const [re, key] of furnitureWords) {
    if (re.test(t)) {
      if (removing) next.furniture = { ...next.furniture, [key]: false };
      else if (adding) next.furniture = { ...next.furniture, [key]: true };
    }
  }

  for (const [word, pal] of Object.entries(COLOR_TO_PALETTE)) {
    if (t.includes(word)) {
      next.symbology = { ...next.symbology, palette: pal, paletteKind: paletteKind(pal) };
      break;
    }
  }
  if (/diverging|red.?blue/.test(t)) next.symbology = { ...next.symbology, palette: "RdBu", paletteKind: "diverging" };
  if (/portrait/.test(t)) next.page = { ...next.page, orientation: "portrait" };
  if (/landscape/.test(t)) next.page = { ...next.page, orientation: "landscape" };
  if (/more class|more colou?rs|more bucket/.test(t))
    next.symbology = { ...next.symbology, classes: Math.min(9, next.symbology.classes + 1) };
  if (/fewer class|less class|fewer colou?rs/.test(t))
    next.symbology = { ...next.symbology, classes: Math.max(3, next.symbology.classes - 1) };
  if (/jenks|natural break/.test(t)) next.symbology = { ...next.symbology, classification: "jenks" };
  if (/equal interval/.test(t)) next.symbology = { ...next.symbology, classification: "equal_interval" };

  const titleMatch = request.match(/(?:title|call it|name it)\s*(?:to|:)?\s*["“]([^"”]+)["”]/i);
  if (titleMatch) next.title = titleMatch[1];

  return parseMapSpec(next);
}
