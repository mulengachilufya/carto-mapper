import { asNumber, type ColumnRoles, type ParsedTable } from "@/lib/data/parse";

/**
 * Facts about a table that drive cartographic choices, computed exactly rather than
 * left for a model to eyeball from a few sample rows:
 *
 *  • skew and outliers        → quantile / natural breaks vs equal interval
 *  • values crossing zero     → diverging palette around a meaningful midpoint
 *  • shares (0 to 1 or 0 to 100)    → percentage formatting
 *  • how many distinct values → how many classes the data can honestly support
 */
export interface DataProfile {
  rows: number;
  columns: string[];
  roles: ColumnRoles;
  value?: {
    column: string;
    count: number;
    min: number;
    max: number;
    mean: number;
    median: number;
    distinct: number;
    skewness: number;
    zeros: number;
    negatives: number;
    positives: number;
    looksLikeShare: "fraction" | "percent" | null;
    outliers: number;
  };
  categories?: { column: string; values: { name: string; count: number }[] };
}

export function profileTable(table: ParsedTable, roles: ColumnRoles): DataProfile {
  const profile: DataProfile = { rows: table.rowCount, columns: table.columns, roles };

  if (roles.valueField) {
    const cells = table.rows.map((r) => r[roles.valueField!]).filter((cell) => asNumber(cell) !== null);
    const vals = cells.map((cell) => asNumber(cell)!);
    const explicitPercent = /%|\b(?:pct|percent(?:age)?)\b/i.test(roles.valueField.replace(/_/g, " "))
      || (cells.length > 0 && cells.every((cell) => typeof cell === "string" && /%\s*$/.test(cell)));
    const explicitFraction = /\b(?:fraction|proportion|0 to 1)\b/i.test(roles.valueField.replace(/_/g, " "));
    if (vals.length) {
      const sorted = [...vals].sort((a, b) => a - b);
      const n = sorted.length;
      const mean = sorted.reduce((s, v) => s + v, 0) / n;
      const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
      const sd = Math.sqrt(sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n) || 1;
      const skewness = sorted.reduce((s, v) => s + ((v - mean) / sd) ** 3, 0) / n;
      const q1 = sorted[Math.floor(n * 0.25)];
      const q3 = sorted[Math.floor(n * 0.75)];
      const iqr = q3 - q1;
      const outliers = sorted.filter((v) => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr).length;
      const min = sorted[0];
      const max = sorted[n - 1];
      profile.value = {
        column: roles.valueField,
        count: n,
        min,
        max,
        mean: round(mean),
        median: round(median),
        distinct: new Set(sorted).size,
        skewness: round(skewness),
        zeros: sorted.filter((v) => v === 0).length,
        negatives: sorted.filter((v) => v < 0).length,
        positives: sorted.filter((v) => v > 0).length,
        looksLikeShare: explicitPercent ? "percent" : explicitFraction && min >= 0 && max <= 1 ? "fraction" : null,
        outliers,
      };
    }
  }

  if (roles.categoryField) {
    const counts = new Map<string, number>();
    for (const r of table.rows) {
      const c = r[roles.categoryField];
      if (c === null || c === undefined || c === "") continue;
      counts.set(String(c), (counts.get(String(c)) ?? 0) + 1);
    }
    profile.categories = {
      column: roles.categoryField,
      values: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, count]) => ({ name, count })),
    };
  }
  return profile;
}

const round = (v: number) => Math.round(v * 1000) / 1000;
