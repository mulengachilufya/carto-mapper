import { geoBounds, geoCentroid, geoContains } from "d3-geo";
import type { Feature, FeatureCollection } from "geojson";
import { CONTINENT_BBOX, findCountry, loadSubdivisions, mainParts, normalizeName, type CountryFeature } from "@/lib/cartography/geo";
import type { ColumnRoles, ParsedTable, Row } from "@/lib/data/parse";
import { parseMapSpec, type MapSpec } from "@/lib/mapspec/schema";

/**
 * When a brief describes data it didn't include ("rainfall by province, Zambia"), the
 * engine marks the spec illustrative and the browser fills in plausible sample values
 * over the right units — the real province names, a smooth spatial pattern, a range
 * that suits the subject — clearly labelled as illustrative on the map.
 */
export async function illustrativeData(
  spec: MapSpec,
  geo: FeatureCollection,
): Promise<{ table: ParsedTable; roles: ColumnRoles; spec: MapSpec } | null> {
  if (!spec.data.illustrative) return null;
  const level = spec.geography.level;
  const country = spec.geography.region ? findCountry(geo, spec.geography.region) : undefined;
  const label = (spec.data.valueLabel ?? "Value").replace(/\s*\(.*\)\s*$/, "").trim() || "Value";
  const range = rangeFor(`${label} ${spec.title}`);

  if (spec.mapType === "choropleth") {
    let units: Feature[] = [];
    let unitCol = "Country";
    if ((level === "admin1" || level === "admin2") && country) {
      const fc = await loadSubdivisions(country.properties.name, level === "admin2" ? 2 : 1);
      units = fc?.features ?? [];
      unitCol = level === "admin2" ? "District" : "Province";
    }
    if (!units.length) {
      const box = level === "continent" && spec.geography.region ? CONTINENT_BBOX[normalizeName(spec.geography.region)] : undefined;
      units = (geo.features as CountryFeature[]).filter((f) => {
        if (!f.properties?.name || normalizeName(f.properties.name) === "antarctica") return false;
        if (!box) return level === "world";
        const [lon, lat] = geoCentroid(f);
        return lon >= box[0] && lon <= box[2] && lat >= box[1] && lat <= box[3];
      });
    }
    if (!units.length) return null;
    const field = smoothField(units);
    const rows: Row[] = units
      .filter((f) => f.properties?.name)
      .map((f) => {
        const [lon, lat] = geoCentroid(f as never);
        return { [unitCol]: String(f.properties!.name), [label]: range.round(range.lo + field(lon, lat) * (range.hi - range.lo)) };
      });
    return pack(rows, [unitCol, label], { nameField: unitCol, valueField: label }, spec);
  }

  if ((spec.mapType === "point" || spec.mapType === "proportional_symbol") && country) {
    const pts = randomPointsIn(mainParts(country), 12);
    const noun = siteNoun(spec.title);
    const rows: Row[] = pts.map(([lon, lat], i) => ({
      Name: `${noun} ${String.fromCharCode(65 + i)}`,
      Latitude: Math.round(lat * 1e4) / 1e4,
      Longitude: Math.round(lon * 1e4) / 1e4,
      ...(spec.mapType === "proportional_symbol" ? { [label]: range.round(range.lo + Math.random() ** 1.8 * (range.hi - range.lo)) } : {}),
    }));
    const cols = ["Name", "Latitude", "Longitude", ...(spec.mapType === "proportional_symbol" ? [label] : [])];
    return pack(rows, cols, { nameField: "Name", latField: "Latitude", lonField: "Longitude", valueField: spec.mapType === "proportional_symbol" ? label : undefined }, spec);
  }
  return null;
}

function pack(rows: Row[], columns: string[], roles: ColumnRoles, spec: MapSpec) {
  return {
    table: { columns, rows, rowCount: rows.length },
    roles,
    spec: parseMapSpec({ ...spec, data: { ...spec.data, ...roles } }),
  };
}

/** Plausible ranges by subject, so illustrative legends don't look absurd. */
function rangeFor(text: string): { lo: number; hi: number; round: (v: number) => number } {
  const t = text.toLowerCase();
  const int = (v: number) => Math.round(v);
  const one = (v: number) => Math.round(v * 10) / 10;
  const big = (v: number) => Math.round(v / 1000) * 1000;
  if (/rain|precip/.test(t)) return { lo: 450, hi: 1400, round: (v) => Math.round(v / 10) * 10 };
  if (/temperat/.test(t)) return { lo: 16, hi: 29, round: one };
  if (/density/.test(t)) return { lo: 8, hi: 420, round: int };
  if (/population|visitors/.test(t)) return { lo: 150_000, hi: 4_500_000, round: big };
  if (/gdp|income|\$/.test(t)) return { lo: 600, hi: 18_000, round: (v) => Math.round(v / 10) * 10 };
  if (/yield/.test(t)) return { lo: 0.8, hi: 4.2, round: one };
  if (/cases|incidents|output/.test(t)) return { lo: 120, hi: 9_000, round: int };
  // Rates and shares in per cent.
  return { lo: 12, hi: 88, round: int };
}

function siteNoun(title: string): string {
  const m = title.match(/\b(Facilit|Clinic|Hospital|School|Office|Borehole|Well|Mine|Project|Station|Branch|Store|Camp)/i);
  return m ? m[1].replace(/Facilit/i, "Facility") : "Site";
}

/** A smooth 0–1 surface over the units' extent: a few broad bumps, like real spatial data. */
function smoothField(units: Feature[]): (lon: number, lat: number) => number {
  const cs = units.map((f) => geoCentroid(f as never));
  const lons = cs.map((c) => c[0]);
  const lats = cs.map((c) => c[1]);
  const [x0, x1, y0, y1] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
  const span = Math.max(1, x1 - x0, y1 - y0);
  const bumps = Array.from({ length: 3 }, () => ({
    lon: x0 + Math.random() * (x1 - x0),
    lat: y0 + Math.random() * (y1 - y0),
    s: span * (0.25 + Math.random() * 0.3),
    a: 0.5 + Math.random() * 0.5,
  }));
  const raw = (lon: number, lat: number) =>
    bumps.reduce((v, b) => v + b.a * Math.exp(-((lon - b.lon) ** 2 + (lat - b.lat) ** 2) / (2 * b.s * b.s)), 0);
  const vals = cs.map(([lon, lat]) => raw(lon, lat));
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  return (lon, lat) => (hi > lo ? (raw(lon, lat) - lo) / (hi - lo) : 0.5) * (0.85 + Math.random() * 0.15);
}

function randomPointsIn(feature: Feature, n: number): [number, number][] {
  const [[w, s], [eRaw, north]] = geoBounds(feature as never);
  const e = eRaw < w ? eRaw + 360 : eRaw;
  const wrap = (lon: number) => (lon > 180 ? lon - 360 : lon);
  const out: [number, number][] = [];
  let tries = 0;
  while (out.length < n && tries < n * 400) {
    tries++;
    const lon = wrap(w + Math.random() * (e - w));
    const lat = s + Math.random() * (north - s);
    if (geoContains(feature as never, [lon, lat])) out.push([lon, lat]);
  }
  return out;
}
