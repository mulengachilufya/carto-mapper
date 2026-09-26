import { geoBounds, geoCentroid, geoContains } from "d3-geo";
import type { FeatureCollection, Feature } from "geojson";
import { CONTINENT_BBOX, findCountry, mainParts, normalizeName, type CountryFeature } from "@/lib/cartography/geo";
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
  return choroplethSample(geo, industry, place.level === "continent" ? place.region : undefined);
}

function pointSample(geo: FeatureCollection, countryName: string, industry: string): SampleResult {
  const feature =
    findCountry(geo, countryName) ?? findCountry(geo, "Zambia") ?? (geo.features[0] as CountryFeature);
  const noun = NOUN[industry] ?? "Site";
  const vc = valueCol(industry);
  const cats = categoriesFor(industry);
  const coords = randomPointsIn(mainParts(feature), 28);

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

function choroplethSample(geo: FeatureCollection, industry: string, region?: string): SampleResult {
  const box = region ? CONTINENT_BBOX[normalizeName(region)] : undefined;
  const all = (geo.features as CountryFeature[]).filter((f) => {
    if (!f.properties?.name || normalizeName(f.properties.name) === "antarctica") return false;
    if (!box) return true;
    const [lon, lat] = geoCentroid(f);
    return lon >= box[0] && lon <= box[2] && lat >= box[1] && lat <= box[3];
  });
  // Real indicators are spatially clustered (neighbours look alike), so build a smooth
  // random surface and read each country's value off it, plus a little local noise.
  // A few gaps keep the "No data" handling honest.
  const field = smoothField();
  const vc = valueCol(industry);
  const rows: Row[] = all
    .filter(() => Math.random() > 0.08)
    .map((f) => {
      const [lon, lat] = geoCentroid(f);
      const v = field(lon, lat) * (0.8 + Math.random() * 0.4);
      return { country: f.properties.name, [vc]: Math.round(20 + v * 480) };
    });
  return {
    table: { columns: ["country", vc], rows, rowCount: rows.length },
    roles: { nameField: "country", valueField: vc },
  };
}

/** A smooth 0–1 surface over lon/lat: a handful of broad Gaussian bumps. */
function smoothField(): (lon: number, lat: number) => number {
  const bumps = Array.from({ length: 5 }, () => ({
    lon: -150 + Math.random() * 300,
    lat: -40 + Math.random() * 100,
    s: 25 + Math.random() * 35,
    a: 0.4 + Math.random() * 0.6,
  }));
  return (lon, lat) => {
    let v = 0;
    for (const b of bumps) v += b.a * Math.exp(-((lon - b.lon) ** 2 + (lat - b.lat) ** 2) / (2 * b.s * b.s));
    return Math.min(1, v);
  };
}

function randomPointsIn(feature: Feature, n: number): [number, number][] {
  const [[w, s], [eRaw, north]] = geoBounds(feature);
  // Bounds crossing the antimeridian come back with east < west; unwrap them.
  const e = eRaw < w ? eRaw + 360 : eRaw;
  const wrap = (lon: number) => (lon > 180 ? lon - 360 : lon);
  const out: [number, number][] = [];
  let tries = 0;
  while (out.length < n && tries < n * 400) {
    tries++;
    const lon = wrap(w + Math.random() * (e - w));
    const lat = s + Math.random() * (north - s);
    if (geoContains(feature, [lon, lat])) out.push([lon, lat]);
  }
  // If the polygon is awkward, fall back to its centroid so points never land abroad.
  const c = geoCentroid(feature);
  while (out.length < n) out.push([c[0], c[1]]);
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
