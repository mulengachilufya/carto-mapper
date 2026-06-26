import Papa from "papaparse";
import * as XLSX from "xlsx";

export type Cell = string | number | null;
export type Row = Record<string, Cell>;

export interface ParsedTable {
  columns: string[];
  rows: Row[];
  rowCount: number;
}

export interface ColumnRoles {
  nameField?: string;
  valueField?: string;
  latField?: string;
  lonField?: string;
  categoryField?: string;
}

// ─── Parsers ─────────────────────────────────────────────────

export function parseCSVText(text: string): ParsedTable {
  const out = Papa.parse<Row>(text, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: true,
    transformHeader: (h) => h.trim(),
  });
  return normalize(out.data, out.meta.fields ?? []);
}

/** Paste box: auto-detect comma / tab / semicolon. */
export function parsePastedText(text: string): ParsedTable {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  const counts: Record<string, number> = {
    ",": (firstLine.match(/,/g) ?? []).length,
    "\t": (firstLine.match(/\t/g) ?? []).length,
    ";": (firstLine.match(/;/g) ?? []).length,
  };
  const delimiter =
    Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[1] > 0
      ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
      : ",";
  const out = Papa.parse<Row>(text, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: true,
    delimiter,
    transformHeader: (h) => h.trim(),
  });
  return normalize(out.data, out.meta.fields ?? []);
}

export async function parseSpreadsheetFile(file: File): Promise<ParsedTable> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    return parseCSVText(await file.text());
  }
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Row>(sheet, { defval: null });
  const columns = json.length ? Object.keys(json[0]) : [];
  return normalize(json, columns);
}

function normalize(rows: Row[], columns: string[]): ParsedTable {
  const cleanCols = columns.map((c) => String(c).trim()).filter(Boolean);
  const cleanRows = rows.filter((r) =>
    Object.values(r).some((v) => v !== null && v !== "" && v !== undefined),
  );
  return { columns: cleanCols, rows: cleanRows, rowCount: cleanRows.length };
}

// ─── Column-role inference ───────────────────────────────────

function values(rows: Row[], col: string): Cell[] {
  return rows.map((r) => r[col]).filter((v) => v !== null && v !== "" && v !== undefined);
}

function asNumber(v: Cell): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v.replace(/[, ]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function numericShare(rows: Row[], col: string): number {
  const vals = values(rows, col);
  if (!vals.length) return 0;
  const nums = vals.filter((v) => asNumber(v) !== null).length;
  return nums / vals.length;
}

function inRange(rows: Row[], col: string, lo: number, hi: number): boolean {
  const nums = values(rows, col)
    .map(asNumber)
    .filter((n): n is number => n !== null);
  if (!nums.length) return false;
  return nums.every((n) => n >= lo && n <= hi);
}

const NAME_RE = /(name|region|district|province|state|county|country|area|place|location|ward|city|town|admin|adm\d)/i;
const LAT_RE = /(^lat$|latitude|^y$)/i;
const LON_RE = /(^lon$|^lng$|^long$|longitude|^x$)/i;
const VALUE_RE = /(value|count|total|number|num|amount|rate|pct|percent|volume|pop|population|patients|cases|sales|revenue|score|qty|quantity)/i;
const CAT_RE = /(category|type|class|group|status|level|sector|gender|segment)/i;

export function inferColumns(table: ParsedTable): ColumnRoles {
  const { columns, rows } = table;
  const roles: ColumnRoles = {};

  // Latitude / longitude — header hint AND value range.
  roles.latField = columns.find((c) => LAT_RE.test(c) && inRange(rows, c, -90, 90));
  roles.lonField = columns.find((c) => LON_RE.test(c) && inRange(rows, c, -180, 180));

  const numericCols = columns.filter(
    (c) => c !== roles.latField && c !== roles.lonField && numericShare(rows, c) >= 0.7,
  );
  const textCols = columns.filter(
    (c) => c !== roles.latField && c !== roles.lonField && numericShare(rows, c) < 0.7,
  );

  // Name: header hint among text columns, else first text column.
  roles.nameField = textCols.find((c) => NAME_RE.test(c)) ?? textCols[0];

  // Value: header hint among numeric columns, else first numeric column.
  roles.valueField = numericCols.find((c) => VALUE_RE.test(c)) ?? numericCols[0];

  // Category: a low-cardinality text column that isn't the name column.
  roles.categoryField =
    textCols.find(
      (c) => c !== roles.nameField && (CAT_RE.test(c) || cardinality(rows, c) <= 12),
    ) ?? undefined;

  return roles;
}

function cardinality(rows: Row[], col: string): number {
  return new Set(values(rows, col).map((v) => String(v))).size;
}

/** Numeric values for a column, dropping non-numeric/blank cells. */
export function numericValues(rows: Row[], col?: string): number[] {
  if (!col) return [];
  return rows
    .map((r) => asNumber(r[col]))
    .filter((n): n is number => n !== null);
}
