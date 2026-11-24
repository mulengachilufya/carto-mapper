import { asCoordinate, asNumber, type ColumnRoles, type ParsedTable } from "@/lib/data/parse";
import type { Brief } from "./brief";

/** Return the missing input for a factual map before calling the designer or saving it. */
export function missingMapInput(brief: Brief, table?: ParsedTable | null, roles?: ColumnRoles): string | null {
  if (!table?.rows.length) {
    if (brief.intent === "reference" || (brief.intent === "footprint" && brief.countries.length)) return null;
    return brief.intent === "thematic"
      ? "Add a table with places and the values you want to map."
      : "Add a list of places or coordinates to map.";
  }

  const { nameField, latField, lonField, valueField } = roles ?? {};
  const located = table.rows.some((row) => {
    if (latField && lonField) {
      const lat = asCoordinate(row[latField]);
      const lon = asCoordinate(row[lonField]);
      return lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
    }
    return Boolean(nameField && String(row[nameField] ?? "").trim());
  });
  if (!located) return "Select a place-name column or supply valid latitude and longitude.";
  if (brief.intent === "thematic" && (brief.theme || valueField) &&
      (!valueField || !table.rows.some((row) => asNumber(row[valueField]) !== null))) {
    return "Select a column with measured values for this map.";
  }
  if (!table.illustrative && valueField &&
      /\b(rate|per capita|per (?:[\d,]+|hundred|thousand|million)|percent(?:age)?|share)\b/i.test(brief.text) &&
      !/\brate\b|proportion|fraction|share|pct|percent|%|\bper\b/i.test(valueField.replace(/_/g, " ")) &&
      /\bcount(?:s)?\b|\btotal(?:s)?\b/i.test(valueField.replace(/_/g, " "))) {
    return "The selected column contains counts or totals. Add a rate or percentage column.";
  }
  return null;
}
