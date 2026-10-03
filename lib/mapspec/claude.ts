import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import {
  parseMapSpec,
  type MapSpec,
  MAP_TYPES,
  MAP_STYLES,
  GEO_LEVELS,
  CLASSIFICATIONS,
  PALETTE_KINDS,
  ORIENTATIONS,
} from "./schema";
import { PALETTES_BY_KIND } from "@/lib/cartography/palettes";
import type { GenerateInput } from "./generate";
import { profileTable } from "./profile";
import type { Decision as LogEntry } from "./schema";
import type { Brief } from "@/lib/engine/brief";

const MODEL = "claude-opus-5";
// If Claude Opus 5's safety classifiers decline a brief, the API re-runs it on this
// model server-side (array form of `fallbacks`; the only form this SDK version types).
const FALLBACK_MODEL = "claude-opus-4-8";
const FALLBACK_BETA = "server-side-fallback-2026-06-01";
// Serverless functions (Netlify) stop at ~26 s. Answer within that or let the rules
// engine design the map — never leave the customer with an error.
const TIMEOUT_MS = 22_000;

export function hasAnthropic(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export interface RevisionContext {
  previousSpec?: MapSpec;
  revisionRequest?: string;
}

const ALL_PALETTES = Object.values(PALETTES_BY_KIND).flat() as [string, ...string[]];

/**
 * What the model decides. Columns are NOT in here: which column holds the places and
 * values was settled by the data resolver, which reads every row — the model designs
 * the map around those facts rather than re-guessing them from a sample.
 */
const Decision = z.object({
  rationale: z.object({
    story: z.string().describe("The one thing a reader should take away, in a sentence."),
    mapType: z.string().describe("Why this map type suits this data and story."),
    classification: z.string().describe("Why this classification and class count, citing the data profile."),
    colour: z.string().describe("Why this palette and palette kind."),
    style: z.string().describe("Why this base-map style suits the audience and use."),
  }),
  title: z.string().describe("Editorial, specific map title — what and where, never generic."),
  subtitle: z.string().describe("Unit, date or scope line; empty string if none is needed."),
  valueLabel: z.string().describe("Legend title naming the real metric and unit; empty string for maps without values."),
  valueFormat: z.string().describe('d3-format string for legend numbers, e.g. "," ".0%" "$,.0f" ".2s".'),
  mapType: z.enum(MAP_TYPES),
  style: z.enum(MAP_STYLES),
  level: z.enum(GEO_LEVELS),
  region: z.string().describe('Country, continent/region name (e.g. "East Africa") or "World".'),
  palette: z.enum(ALL_PALETTES),
  paletteKind: z.enum(PALETTE_KINDS),
  reversePalette: z.boolean(),
  classes: z.number().int().describe("3 to 7; fewer when the data has few distinct values."),
  classification: z.enum(CLASSIFICATIONS),
  orientation: z.enum(ORIENTATIONS),
  furniture: z.object({
    legend: z.boolean(),
    scalebar: z.boolean(),
    north_arrow: z.boolean(),
    graticule: z.boolean(),
    labels: z.boolean(),
  }),
});
type DecisionT = z.infer<typeof Decision>;

export interface ClaudeDesign {
  spec: MapSpec;
  rationale: DecisionT["rationale"];
  /** The rationale as decision-log entries. */
  decisions: LogEntry[];
}

/** The engine's reading of the brief and its rulebook design — what the AI refines. */
export interface Baseline {
  brief: Brief;
  spec: MapSpec;
}

export async function generateMapSpecWithClaude(input: GenerateInput, revision: RevisionContext | undefined, baseline: Baseline): Promise<ClaudeDesign> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: TIMEOUT_MS, maxRetries: 0 });

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: [{ model: FALLBACK_MODEL }],
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: betaZodOutputFormat(Decision) },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildBrief(input, revision, baseline) }],
  });

  // A refusal from the whole fallback chain, or an unparseable answer, goes to the
  // caller's fallback (the rules engine) rather than producing a half-designed map.
  if (response.stop_reason === "refusal") throw new Error("map design request was declined");
  const d = response.parsed_output;
  if (!d) throw new Error(`no structured design returned (stop_reason: ${response.stop_reason})`);

  const r = d.rationale;
  const decisions: LogEntry[] = [
    { rule: "AI", topic: "Story", choice: d.title, because: r.story, by: "ai" as const },
    { rule: "AI", topic: "Map type", choice: d.mapType, because: r.mapType, by: "ai" as const },
    { rule: "AI", topic: "Classes", choice: `${d.classes} ${d.classification.replace("_", " ")}`, because: r.classification, by: "ai" as const },
    { rule: "AI", topic: "Colour", choice: d.palette, because: r.colour, by: "ai" as const },
    { rule: "AI", topic: "Style", choice: d.style, because: r.style, by: "ai" as const },
  ].filter((x) => x.because.trim());
  return { spec: applyDecision(revision?.previousSpec ?? baseline.spec, d), rationale: r, decisions };
}

/**
 * Layer the model's decisions onto a complete, valid spec (the previous one when
 * revising, else the rules engine's), field by field — one odd value can't reset
 * the whole map to defaults.
 */
function applyDecision(base: MapSpec, d: DecisionT): MapSpec {
  const classes = Math.min(7, Math.max(2, Math.round(d.classes)));
  const next = {
    ...base,
    title: d.title.trim() || base.title,
    subtitle: d.subtitle.trim() || undefined,
    mapType: d.mapType,
    style: d.style,
    geography: { ...base.geography, level: d.level, region: d.region.trim() || base.geography.region },
    data: {
      ...base.data,
      valueLabel: d.valueLabel.trim() || base.data.valueLabel,
      valueFormat: d.valueFormat.trim() || base.data.valueFormat,
    },
    symbology: {
      ...base.symbology,
      palette: d.palette,
      paletteKind: d.paletteKind,
      reverse: d.reversePalette,
      classes,
      classification: d.classification,
    },
    furniture: { ...base.furniture, ...d.furniture },
    page: { ...base.page, orientation: d.orientation },
    notes: [d.rationale.story, d.rationale.mapType, d.rationale.classification, d.rationale.colour, d.rationale.style]
      .filter(Boolean)
      .join(" "),
  };
  const parsed = parseMapSpec(next);
  // parseMapSpec falls back to defaults on invalid input; keep the base in that case.
  return parsed.title === "Untitled Map" && base.title !== "Untitled Map" ? base : parsed;
}

const SYSTEM_PROMPT = `You are CartoMapper's senior cartographer. A customer — an NGO officer, a planner, a researcher, a teacher — describes a map and gives you data. You design the map the way a professional human cartographer would for a printed atlas or report, and a renderer draws exactly what you specify.

What the renderer can draw (so design for it):
- Map types: reference (an atlas plate with no data: every province/district/country tinted apart from its neighbours and named — for "Provinces of Zambia", "map of Kenya", "political map of Africa"), choropleth (shade regions by value), footprint (highlight regions, no values), proportional_symbol (circles sized by value, area-true), graduated_symbol, dot (one dot per record), point (labelled sites), categorical_point (sites coloured by category).
- Geography: every country; provinces/states/counties (admin1) and districts (admin2) for ~200 countries; points anywhere. Levels: world, continent (with region names like "East Africa", "Southern Africa", "Europe", "South America", "Middle East"), country, admin1, admin2, city.
- Styles:
  • atlas — a physical school-atlas page: hypsometric relief and hillshade, sea depths, rivers, lakes, peaks, serif place names. Data colours keep a terrain texture. Best for locator maps, sites, physical context, general audiences, anything where "where" matters.
  • classic — a political atlas page: pastel countries, water-lined coasts, capitals. Best for "where we work" footprints and country-level stories at world or continent scale.
  • minimal — paper and ink only. Best for dense choropleths in reports, academic figures, and when the data must be the only colour.
- Furniture: legend, scale bar, north arrow, graticule, place-name labels, title, subtitle, source line.

How to decide:
- The data profile you receive is computed from every row; trust it over the sample rows.
- Values that cross zero around a meaningful midpoint (change, growth, balance) → diverging palette. One-directional quantities → sequential. Categories → qualitative.
- Skewed data (|skewness| > 1, or outliers) → quantile or natural breaks (jenks); evenly spread data → equal_interval. Never use more classes than the data has distinct values; 5 is typical, 3–4 for small tables.
- Counts at sites (patients, sales, beneficiaries) → proportional symbols, not a choropleth. Rates and shares over regions → choropleth. Raw counts over regions of very different size mislead as a choropleth — say so in the rationale and prefer proportional symbols at the region centres unless the customer insists.
- Shares stored as fractions (0–1) format as ".0%"; percentages stored 0–100 need a "%" in the legend label instead.
- World and continent maps: graticule on, no scale bar (scale varies across them), no north arrow on world maps. Country and smaller: scale bar and a discreet north arrow, no graticule. Place names on, unless a dense choropleth of many small regions would be cluttered.
- Portrait suits tall places (Chile, Japan, Malawi, Norway) and report pages; landscape suits wide ones and the world.
- Titles are editorial and specific ("Household Access to Piped Water by County, Kenya"), never "Map of data". Put units, dates and "illustrative data" in the subtitle.
- Honour the customer's explicit wishes (colours, style, emphasis) unless they break cartographic honesty — then do the honest thing and explain why in the rationale.
- When revising, change only what the request asks; keep every other decision.`;

function buildBrief(input: GenerateInput, revision: RevisionContext | undefined, baseline: Baseline): string {
  const parts: string[] = [];
  if (input.vibe) parts.push(`Customer's description:\n"""${input.vibe}"""`);
  const b = baseline.brief;
  parts.push(
    `The engine's reading of the description (deterministic; treat place and units as the customer's words):\n${JSON.stringify({
      place: b.place,
      countries: b.countries,
      units: b.units,
      subject: b.theme?.label ?? null,
      intent: b.intent,
      style: b.style,
      colour: b.palette,
      year: b.year,
    })}`,
    `The rulebook's baseline design (improve it where cartographic judgement says so; keep its geography unless the data says otherwise — a checker enforces geography, type/data fit, class counts, honest colour and scale conventions after you):\n${JSON.stringify(summarise(baseline.spec))}`,
  );

  if (input.geography) {
    parts.push(
      `Geography resolved from the data (authoritative): level=${input.geography.level}${input.geography.region ? `, region=${input.geography.region}` : ""}.`,
    );
  }

  const table = input.table;
  if (table && input.roles) {
    const profile = profileTable(table, input.roles);
    parts.push(`Data profile (computed from all ${profile.rows} rows):\n${JSON.stringify(profile, null, 1)}`);
    parts.push(`Sample rows:\n${JSON.stringify(table.rows.slice(0, 12))}`);
  } else {
    parts.push("No data table was provided — the map will use illustrative sample data; design for the described subject.");
  }

  if (revision?.revisionRequest && revision.previousSpec) {
    parts.push(
      `This is a REVISION of an existing map. Current design:\n${JSON.stringify(summarise(revision.previousSpec))}`,
      `The customer asks: """${revision.revisionRequest}"""\nChange only what this asks for.`,
    );
  }
  parts.push("Design the map.");
  return parts.join("\n\n");
}

function summarise(s: MapSpec) {
  return {
    title: s.title,
    subtitle: s.subtitle,
    mapType: s.mapType,
    style: s.style,
    level: s.geography.level,
    region: s.geography.region,
    valueLabel: s.data.valueLabel,
    valueFormat: s.data.valueFormat,
    palette: s.symbology.palette,
    paletteKind: s.symbology.paletteKind,
    reversePalette: s.symbology.reverse,
    classes: s.symbology.classes,
    classification: s.symbology.classification,
    orientation: s.page.orientation,
    furniture: s.furniture,
  };
}
