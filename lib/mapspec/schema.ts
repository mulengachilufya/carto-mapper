import { z } from "zod";

/**
 * The MapSpec is the single source of truth for a map. It is produced by the
 * map-intelligence step (Claude API, with a deterministic fallback) and consumed
 * by the D3 renderer. Validated with Zod so untrusted model output can never
 * crash the renderer — anything missing or malformed falls back to a sane default.
 */

export const MAP_TYPES = [
  "choropleth", // filled regions coloured by a value
  "proportional_symbol", // circles sized by a value, at points/centroids
  "graduated_symbol", // circles sized + coloured by class
  "dot", // one dot per record (density)
  "point", // simple located points
  "categorical_point", // points coloured by category
] as const;

export const GEO_LEVELS = [
  "world",
  "continent",
  "country",
  "admin1", // province / state
  "admin2", // district / county
  "city",
] as const;

export const PALETTE_KINDS = ["sequential", "diverging", "qualitative"] as const;
export const CLASSIFICATIONS = ["quantile", "equal_interval", "jenks"] as const;
export const PAGE_SIZES = ["A4", "Letter"] as const;
export const ORIENTATIONS = ["portrait", "landscape"] as const;

export const FurnitureSchema = z.object({
  title: z.boolean().default(true),
  legend: z.boolean().default(true),
  scalebar: z.boolean().default(true),
  north_arrow: z.boolean().default(true),
  caption: z.boolean().default(false),
  source: z.boolean().default(true),
  graticule: z.boolean().default(true),
});
export type Furniture = z.infer<typeof FurnitureSchema>;

export const MapSpecSchema = z.object({
  version: z.literal(1).default(1),

  // Text
  title: z.string().default("Untitled Map"),
  subtitle: z.string().optional(),
  caption: z.string().optional(),
  source: z.string().optional(),

  mapType: z.enum(MAP_TYPES).default("choropleth"),

  geography: z
    .object({
      level: z.enum(GEO_LEVELS).default("world"),
      region: z.string().optional(), // e.g. "Zambia", "East Africa"
      iso: z.string().optional(), // ISO A3 if a single country, e.g. "ZMB"
      focus: z.array(z.string()).optional(), // names to emphasise
      projectionHint: z.string().optional(), // e.g. "equalEarth" | "albers" | "mercator"
    })
    .default({ level: "world" }),

  // How tabular columns map to map roles
  data: z
    .object({
      nameField: z.string().optional(), // region / place name column
      valueField: z.string().optional(), // numeric metric column
      categoryField: z.string().optional(),
      latField: z.string().optional(),
      lonField: z.string().optional(),
      valueLabel: z.string().optional(), // legend title, e.g. "Patients / year"
      valueFormat: z.string().optional(), // d3-format string, e.g. ",", ".0%", "$,"
    })
    .default({}),

  symbology: z
    .object({
      palette: z.string().default("Blues"), // ColorBrewer scheme name
      paletteKind: z.enum(PALETTE_KINDS).default("sequential"),
      classes: z.number().int().min(3).max(9).default(5),
      classification: z.enum(CLASSIFICATIONS).default("quantile"),
      reverse: z.boolean().default(false),
      minRadius: z.number().default(2),
      maxRadius: z.number().default(26),
    })
    .default({
      palette: "Blues",
      paletteKind: "sequential",
      classes: 5,
      classification: "quantile",
      reverse: false,
      minRadius: 2,
      maxRadius: 26,
    }),

  furniture: FurnitureSchema.default({
    title: true,
    legend: true,
    scalebar: true,
    north_arrow: true,
    caption: false,
    source: true,
    graticule: true,
  }),

  page: z
    .object({
      size: z.enum(PAGE_SIZES).default("A4"),
      orientation: z.enum(ORIENTATIONS).default("landscape"),
    })
    .default({ size: "A4", orientation: "landscape" }),

  notes: z.string().optional(), // human-readable rationale
});

export type MapSpec = z.infer<typeof MapSpecSchema>;
export type MapType = (typeof MAP_TYPES)[number];
export type GeoLevel = (typeof GEO_LEVELS)[number];
export type PaletteKind = (typeof PALETTE_KINDS)[number];
export type Classification = (typeof CLASSIFICATIONS)[number];

/** Parse loosely — never throws; fills defaults for anything malformed. */
export function parseMapSpec(input: unknown): MapSpec {
  const result = MapSpecSchema.safeParse(input ?? {});
  if (result.success) return result.data;
  // Last-resort: take whatever parsed and let defaults fill the rest.
  return MapSpecSchema.parse({});
}
