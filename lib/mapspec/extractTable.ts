import type { ParsedTable, ColumnRoles, Row } from "@/lib/data/parse";
import type { Extracted } from "./extract";

export interface ExtractResult {
  table: ParsedTable | null;
  roles: ColumnRoles | null;
  mapType?: string;
  title?: string;
  region?: string;
  valueLabel?: string;
  summary?: string;
  /** What the fact-check changed: names removed or corrected, for the customer to see. */
  checks?: string[];
}

export function buildResult(d: Extracted): ExtractResult {
  const places = (d.places ?? []).filter((p) => p && p.name);
  const meta = { mapType: d.suggestedMapType, title: d.title, region: d.region, valueLabel: d.valueLabel, summary: d.summary, checks: d.checks?.length ? d.checks : undefined };
  if (!places.length) return { table: null, roles: null, ...meta };

  const hasCoords = places.some((p) => typeof p.lat === "number" && typeof p.lon === "number");
  const hasValue = places.some((p) => typeof p.value === "number");
  const hasCat = places.some((p) => p.category);

  const columns = ["name"];
  if (hasCoords) columns.push("latitude", "longitude");
  if (hasValue) columns.push("value");
  if (hasCat) columns.push("category");

  const rows: Row[] = places.map((p) => {
    const r: Row = { name: p.name };
    if (hasCoords) {
      r.latitude = typeof p.lat === "number" ? p.lat : null;
      r.longitude = typeof p.lon === "number" ? p.lon : null;
    }
    if (hasValue) r.value = typeof p.value === "number" ? p.value : null;
    if (hasCat) r.category = p.category ?? null;
    return r;
  });

  const roles: ColumnRoles = { nameField: "name" };
  if (hasCoords) {
    roles.latField = "latitude";
    roles.lonField = "longitude";
  }
  if (hasValue) roles.valueField = "value";
  if (hasCat) roles.categoryField = "category";

  return { table: { columns, rows, rowCount: rows.length }, roles, ...meta };
}
