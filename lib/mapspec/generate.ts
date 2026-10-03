import { type MapSpec, type GeoLevel, parseMapSpec } from "./schema";
import type { ColumnRoles, ParsedTable } from "@/lib/data/parse";
import { paletteKind } from "@/lib/cartography/palettes";
import { readBrief } from "@/lib/engine/brief";

export interface GenerateInput {
  industry: string;
  customIndustry?: string;
  answers: Record<string, string>;
  vibe?: string;
  table?: ParsedTable | null;
  roles?: ColumnRoles;
  outputOptions?: Partial<MapSpec["furniture"]>;
  /** Where the data resolver placed the data (e.g. admin1 of Kenya). */
  geography?: { level: GeoLevel; region?: string };
}

// ─── Place detection ─────────────────────────────────────────
/** The place a sentence names, read by the engine's brief reader (every country, regions, the world). */
export function detectPlace(vibe: string): { region?: string; level?: GeoLevel } {
  const b = readBrief(vibe);
  if (!b.place) return {};
  if (b.place.kind === "world") return { region: "World", level: "world" };
  if (b.place.kind === "region") return { region: b.place.name, level: "continent" };
  return { region: b.place.name, level: "country" };
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
