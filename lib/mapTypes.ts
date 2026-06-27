import type { FeatureCollection } from "geojson";
import { parseMapSpec, type MapSpec, type MapType } from "@/lib/mapspec/schema";
import { generateSample } from "@/lib/data/sample";
import type { Row } from "@/lib/data/parse";
import type { CountryFeature } from "@/lib/cartography/geo";

/**
 * The catalogue of map types the user picks from. Each "ready" type can render a
 * live sample (built by our own engine — no third-party images) and carries a
 * plain-English "best for" so we can recommend the right one.
 */
export interface MapTypeDef {
  id: MapType | "flow" | "buffer" | "annotation";
  name: string;
  tagline: string; // short "best for"
  needs: "regions+value" | "regions" | "points" | "points+value" | "points+category";
  ready: boolean;
  sample?: (geo: FeatureCollection) => { spec: MapSpec; data: Row[] };
}

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function zambiaPoints(geo: FeatureCollection): { table: ReturnType<typeof generateSample>["table"]; roles: ReturnType<typeof generateSample>["roles"] } {
  return generateSample(geo, { industry: "healthcare", answers: { geographic_scope: "national", show_what: "locations" }, vibe: "Zambia" });
}

const baseFurniture = (over: Partial<MapSpec["furniture"]>) => ({
  title: true,
  legend: true,
  source: true,
  caption: false,
  scalebar: true,
  north_arrow: true,
  graticule: false,
  ...over,
});

export const MAP_TYPES_CATALOGUE: MapTypeDef[] = [
  {
    id: "choropleth",
    name: "Choropleth",
    tagline: "Values shaded across regions — rates, %, KPIs, prevalence by area.",
    needs: "regions+value",
    ready: true,
    sample: (geo) => {
      const s = generateSample(geo, { industry: "research", answers: { geographic_scope: "global", show_what: "values" } });
      return {
        data: s.table.rows,
        spec: parseMapSpec({
          title: "Indicator by Country",
          mapType: "choropleth",
          geography: { level: "world", region: "World" },
          data: { nameField: "country", valueField: s.roles.valueField, valueLabel: "Index" },
          symbology: { palette: "YlGnBu", paletteKind: "sequential", classes: 5, classification: "quantile" },
          furniture: baseFurniture({ scalebar: false, north_arrow: false, graticule: true }),
        }),
      };
    },
  },
  {
    id: "footprint",
    name: "Footprint / highlight",
    tagline: "Highlight the countries or regions you work in — donor reach, coverage.",
    needs: "regions",
    ready: true,
    sample: (geo) => {
      const picked = shuffle(geo.features as CountryFeature[]).slice(0, 6).map((f) => f.properties.name);
      return {
        data: picked.map((country) => ({ country })),
        spec: parseMapSpec({
          title: "Where We Work",
          mapType: "footprint",
          geography: { level: "world", region: "World" },
          data: { nameField: "country" },
          symbology: { palette: "Greens", paletteKind: "sequential" },
          furniture: baseFurniture({ legend: false, scalebar: false, north_arrow: false, graticule: true }),
        }),
      };
    },
  },
  {
    id: "proportional_symbol",
    name: "Proportional symbols",
    tagline: "Counts at places — circles sized by patients, beneficiaries, sales…",
    needs: "points+value",
    ready: true,
    sample: (geo) => {
      const s = zambiaPoints(geo);
      return {
        data: s.table.rows,
        spec: parseMapSpec({
          title: "Facilities by Volume",
          mapType: "proportional_symbol",
          geography: { level: "country", region: "Zambia" },
          data: { nameField: "name", latField: "latitude", lonField: "longitude", valueField: s.roles.valueField, valueLabel: "Patients" },
          symbology: { palette: "BuGn", paletteKind: "sequential", minRadius: 2, maxRadius: 22 },
          furniture: baseFurniture({ graticule: false }),
        }),
      };
    },
  },
  {
    id: "categorical_point",
    name: "Categorical points",
    tagline: "Locations coloured by type or category — facility types, status.",
    needs: "points+category",
    ready: true,
    sample: (geo) => {
      const s = zambiaPoints(geo);
      return {
        data: s.table.rows,
        spec: parseMapSpec({
          title: "Facilities by Type",
          mapType: "categorical_point",
          geography: { level: "country", region: "Zambia" },
          data: { nameField: "name", latField: "latitude", lonField: "longitude", categoryField: s.roles.categoryField },
          symbology: { palette: "Set2", paletteKind: "qualitative" },
          furniture: baseFurniture({ graticule: false }),
        }),
      };
    },
  },
  {
    id: "dot",
    name: "Dot distribution",
    tagline: "Distribution & density — one dot per record across an area.",
    needs: "points",
    ready: true,
    sample: (geo) => {
      const s = zambiaPoints(geo);
      return {
        data: s.table.rows,
        spec: parseMapSpec({
          title: "Distribution",
          mapType: "dot",
          geography: { level: "country", region: "Zambia" },
          data: { nameField: "name", latField: "latitude", lonField: "longitude" },
          symbology: { palette: "BuGn", paletteKind: "sequential" },
          furniture: baseFurniture({ legend: false, graticule: false }),
        }),
      };
    },
  },
  {
    id: "point",
    name: "Locator / sites",
    tagline: "Where things are — clean located pins, great for project sites.",
    needs: "points",
    ready: true,
    sample: (geo) => {
      const s = zambiaPoints(geo);
      return {
        data: s.table.rows.slice(0, 10),
        spec: parseMapSpec({
          title: "Project Sites",
          mapType: "point",
          geography: { level: "country", region: "Zambia" },
          data: { nameField: "name", latField: "latitude", lonField: "longitude" },
          symbology: { palette: "OrRd", paletteKind: "sequential" },
          furniture: baseFurniture({ legend: false, graticule: false }),
        }),
      };
    },
  },
  // ── Coming next (slice 2) ──
  { id: "flow", name: "Flow / connectivity", tagline: "Connections & movement — supply chains, trade, corridors.", needs: "points", ready: false },
  { id: "buffer", name: "Catchment / buffer", tagline: "Access or exclusion radius — coverage zones around points.", needs: "points", ready: false },
  { id: "annotation", name: "Executive callouts", tagline: "Leader lines and text boxes pointing to key facts.", needs: "points", ready: false },
];

export function getMapTypeDef(id: string): MapTypeDef | undefined {
  return MAP_TYPES_CATALOGUE.find((t) => t.id === id);
}

export const READY_MAP_TYPES = MAP_TYPES_CATALOGUE.filter((t) => t.ready);
