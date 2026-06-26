import { geoBounds, geoContains } from "d3-geo";
import type { FeatureCollection, Feature } from "geojson";
import { findCountry, type CountryFeature } from "@/lib/cartography/geo";
import { detectPlace } from "@/lib/mapspec/generate";
import { getIndustry } from "@/lib/industries";
import type { ParsedTable, ColumnRoles, Row } from "@/lib/data/parse";

export interface SampleResult {
  table: ParsedTable;
  roles: ColumnRoles;
}

const NOUN: Record<string, string> = {
  healthcare: "Clinic",
  education: "School",
  sports: "Venue",
  arts: "Venue",
  ngo: "Project Site",
  environment: "Site",
  agriculture: "Farm",
  realestate: "Property",
  tourism: "Attraction",
  public_health: "Site",
  emergency: "Incident",
  mining: "Site",
  transport: "Hub",
  energy: "Asset",
  journalism: "Location",
  research: "Site",
  faith: "Congregation",
  social_services: "Office",
  finance: "Branch",
  construction: "Project",
  retail: "Store",
  wash: "Water Point",
  government: "Facility",
  custom: "Site",
};

// A meaningful name for the value column, so titles/legends read well.
const VALUE_COL: Record<string, string> = {
  healthcare: "patients",
  public_health: "cases",
  education: "students",
  ngo: "beneficiaries",
  wash: "households",
  sports: "participants",
  arts: "visitors",
  government: "population",
  environment: "hectares",
  agriculture: "yield",
  realestate: "price",
  tourism: "visitors",
  emergency: "incidents",
  mining: "output",
  transport: "volume",
  energy: "capacity",
  journalism: "count",
  research: "index",
  faith: "members",
  social_services: "clients",
  finance: "accounts",
  construction: "projects",
  retail: "sales",
  custom: "value",
};

const valueCol = (industry: string) => VALUE_COL[industry] ?? "value";

/** Illustrative data so a user can preview a real map without uploading. */
export function generateSample(
  geo: FeatureCollection,
  opts: { industry: string; answers: Record<string, string>; vibe?: string },
): SampleResult {
  const { industry, answers } = opts;
  const vibe = opts.vibe ?? "";
  const scope = answers.geographic_scope ?? "";
  const place = detectPlace(vibe);

  const countryFocus =
    place.level === "country"
      ? place.region
      : ["national", "province", "district", "local", "city"].includes(scope)
        ? (place.region ?? "Zambia")
        : undefined;

  if (countryFocus) return pointSample(geo, countryFocus, industry);
  return choroplethSample(geo, industry);
}

function pointSample(geo: FeatureCollection, countryName: string, industry: string): SampleResult {
  const feature =
    findCountry(geo, countryName) ?? findCountry(geo, "Zambia") ?? (geo.features[0] as CountryFeature);
  const noun = NOUN[industry] ?? "Site";
  const vc = valueCol(industry);
  const cats = categoriesFor(industry);
  const coords = randomPointsIn(feature, 28);

  const rows: Row[] = coords.map((c, i) => ({
    name: `${noun} ${i + 1}`,
    latitude: round(c[1]),
    longitude: round(c[0]),
    [vc]: sampleValue(),
    category: cats[i % cats.length],
  }));

  return {
    table: { columns: ["name", "latitude", "longitude", vc, "category"], rows, rowCount: rows.length },
    roles: {
      nameField: "name",
      latField: "latitude",
      lonField: "longitude",
      valueField: vc,
      categoryField: "category",
    },
  };
}

function choroplethSample(geo: FeatureCollection, industry: string): SampleResult {
  const all = (geo.features as CountryFeature[]).filter((f) => f.properties?.name);
  const picked = shuffle(all).slice(0, 24);
  const vc = valueCol(industry);
  const rows: Row[] = picked.map((f) => ({ country: f.properties.name, [vc]: sampleValue() }));
  return {
    table: { columns: ["country", vc], rows, rowCount: rows.length },
    roles: { nameField: "country", valueField: vc },
  };
}

function randomPointsIn(feature: Feature, n: number): [number, number][] {
  const [[w, s], [e, north]] = geoBounds(feature);
  const out: [number, number][] = [];
  let tries = 0;
  while (out.length < n && tries < n * 400) {
    tries++;
    const lon = w + Math.random() * (e - w);
    const lat = s + Math.random() * (north - s);
    if (geoContains(feature, [lon, lat])) out.push([lon, lat]);
  }
  // If the polygon is awkward, fall back to bbox points so we always return something.
  while (out.length < n) {
    out.push([w + Math.random() * (e - w), s + Math.random() * (north - s)]);
  }
  return out;
}

function categoriesFor(industry: string): string[] {
  const ind = getIndustry(industry);
  const opts = (ind?.questions[0].options ?? [])
    .filter((o) => !/mixed|multi|other/i.test(o.value))
    .slice(0, 3)
    .map((o) => o.label.split("/")[0].split("(")[0].trim());
  return opts.length >= 2 ? opts : ["Type A", "Type B", "Type C"];
}

function sampleValue(): number {
  return Math.round(40 * Math.exp(Math.random() * 2.6));
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
