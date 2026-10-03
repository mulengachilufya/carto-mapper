import Papa from "papaparse";
import { asNumber, type ParsedTable, type Row } from "@/lib/data/parse";

/**
 * Read whatever someone pastes into a table — no required format:
 *
 *   • a table with or without a header row (tab, comma, semicolon, pipe or
 *     aligned with spaces — pasted from Excel, Sheets, Word or a PDF)
 *   • a Markdown table
 *   • a plain list of places, one per line or "Kenya, Uganda, Tanzania"
 *   • "Place  1,200" lines (a name followed by a number)
 *   • coordinates, decimal or degrees ("-15.41, 28.28", "15°25′S 28°17′E"),
 *     with or without a label
 *
 * Returns null when the text is prose; the caller then looks for place names
 * in the sentences instead (see resolve.ts).
 */
export function parseAnything(raw: string): ParsedTable | null {
  let text = raw.replace(/\r/g, "").trim();
  if (!text) return null;

  // Markdown table → tab-separated, dropping the |---|---| rule.
  if (/^\s*\|.*\|\s*$/m.test(text)) {
    text = text
      .split("\n")
      .filter((l) => !/^\s*\|?\s*:?-{2,}/.test(l))
      .map((l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()).join("\t"))
      .join("\n");
  }

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // One line of names: "Kenya, Uganda, Tanzania and Rwanda".
  if (lines.length === 1 && !/\d/.test(lines[0]) && /[,;]|\band\b/.test(lines[0])) {
    const names = lines[0].split(/\s*(?:[,;]|\band\b)\s*/i).map((n) => n.trim()).filter(Boolean);
    if (names.length >= 2 && names.every((n) => n.split(/\s+/).length <= 5)) return table(["Place"], names.map((n) => [n]));
  }

  // Coordinates, one pair per line, optionally labelled.
  const coords = lines.map(parseCoordLine);
  if (coords.filter(Boolean).length >= Math.max(1, lines.length * 0.6)) {
    const rows = coords.filter((c): c is CoordLine => c !== null);
    const hasLabel = rows.some((r) => r.label);
    const hasValue = rows.some((r) => r.value !== null);
    const cols = [...(hasLabel ? ["Place"] : []), "Latitude", "Longitude", ...(hasValue ? ["Value"] : [])];
    return table(
      cols,
      rows.map((r) => [...(hasLabel ? [r.label || null] : []), r.lat, r.lon, ...(hasValue ? [r.value] : [])]),
    );
  }

  // Prose (long sentences with no consistent delimiter) isn't a table.
  const wordy = lines.filter((l) => l.split(/\s+/).length > 9 && !/[\t;|]/.test(l)).length;
  if (wordy >= Math.ceil(lines.length / 2)) return null;

  // Delimited table: pick the delimiter that splits lines most consistently.
  const delimiter = pickDelimiter(lines);
  let grid: string[][];
  if (delimiter) {
    // Columns aligned with runs of spaces (copied from a PDF or Word table) become tabs.
    const body = delimiter === ALIGNED ? lines.map((l) => l.replace(/\s{2,}/g, "\t")) : lines;
    const parsed = Papa.parse<string[]>(body.join("\n"), { delimiter: delimiter === ALIGNED ? "\t" : delimiter, skipEmptyLines: "greedy" });
    grid = parsed.data.map((r) => r.map((c) => String(c ?? "").trim()));
  } else {
    // No delimiter: "Lusaka 4500" (name then number) or a bare list of names.
    grid = lines.map((l) => {
      const m = l.match(/^(.*?)[\s:;,–-]+([-+(]?[$€£]?\d[\d,.\s]*(?:k|m|bn|%)?\)?)$/i);
      return m && m[1].trim() ? [m[1].trim(), m[2].trim()] : [l];
    });
  }
  const width = Math.max(...grid.map((r) => r.length));
  grid = grid.map((r) => [...r, ...Array(width - r.length).fill("")]);

  // Header row? Yes if it has no numbers while the rows below do, or if it reads like headers.
  const [first, ...rest] = grid;
  const numericIn = (r: string[]) => r.some((c) => asNumber(c) !== null);
  const looksLikeHeader =
    rest.length > 0 &&
    ((!numericIn(first) && rest.filter(numericIn).length >= rest.length * 0.5) ||
      first.some((c) => /^(name|place|country|region|district|province|state|county|city|town|site|value|count|total|lat|latitude|lon|lng|longitude|category|type)$/i.test(c)));

  const header = looksLikeHeader ? first.map((c, i) => c || `Column ${i + 1}`) : defaultHeaders(grid);
  const body = looksLikeHeader ? rest : grid;
  return table(dedupe(header), body.map((r) => r.map((c) => (c === "" ? null : c))));
}

// ── helpers ──

function table(columns: string[], rows: (string | number | null)[][]): ParsedTable {
  const out: Row[] = rows
    .map((r) => Object.fromEntries(columns.map((c, i) => [c, typed(r[i] ?? null)])) as Row)
    .filter((r) => Object.values(r).some((v) => v !== null && v !== ""));
  return { columns, rows: out, rowCount: out.length };
}

/** Keep numbers as numbers so downstream code can classify them. */
function typed(v: string | number | null): string | number | null {
  if (v === null || typeof v === "number") return v;
  const n = asNumber(v);
  return n !== null && /\d/.test(v) && !/[a-z]{3,}/i.test(v) ? n : v;
}

function pickDelimiter(lines: string[]): string | null {
  const candidates = ["\t", ";", "|", ",", /\s{2,}/.source];
  let best: { d: string; score: number } | null = null;
  for (const d of candidates) {
    const re = d.length > 1 ? new RegExp(d, "g") : new RegExp(`\\${d}`, "g");
    const counts = lines.map((l) => (l.match(re) ?? []).length);
    const positive = counts.filter((c) => c > 0);
    if (positive.length < lines.length * 0.8) continue;
    const mode = mostCommon(positive);
    const consistency = counts.filter((c) => c === mode).length / lines.length;
    // Commas inside numbers ("1,200") make comma counts noisy — prefer other delimiters on ties.
    const score = consistency + (d === "," ? -0.05 : 0);
    if (consistency >= 0.7 && (!best || score > best.score)) best = { d, score };
  }
  if (!best) return null;
  return best.d === /\s{2,}/.source ? ALIGNED : best.d;
}

/** Marker for columns aligned with runs of spaces rather than a delimiter character. */
const ALIGNED = "aligned";

function mostCommon(xs: number[]) {
  const m = new Map<number, number>();
  xs.forEach((x) => m.set(x, (m.get(x) ?? 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function defaultHeaders(grid: string[][]): string[] {
  const width = grid[0]?.length ?? 1;
  const numericCol = (i: number) => grid.filter((r) => asNumber(r[i]) !== null).length >= grid.length * 0.7;
  let valueN = 0;
  return Array.from({ length: width }, (_, i) => {
    if (!numericCol(i)) return i === 0 ? "Place" : `Detail ${i}`;
    valueN++;
    return valueN === 1 ? "Value" : `Value ${valueN}`;
  });
}

function dedupe(cols: string[]): string[] {
  const seen = new Map<string, number>();
  return cols.map((c) => {
    const n = seen.get(c) ?? 0;
    seen.set(c, n + 1);
    return n ? `${c} (${n + 1})` : c;
  });
}

interface CoordLine {
  lat: number;
  lon: number;
  label: string;
  value: number | null;
}

const DMS = /(\d{1,3}(?:\.\d+)?)\s*°\s*(?:(\d{1,2}(?:\.\d+)?)\s*['′’]\s*)?(?:(\d{1,2}(?:\.\d+)?)\s*["″”]\s*)?([NSEW])/gi;
const DECIMAL = /([-+]?\d{1,2}\.\d{2,})\s*[,;\s]\s*([-+]?\d{1,3}\.\d{2,})/;

/** A line holding a coordinate pair, e.g. "Lusaka -15.41, 28.28" or "15°25′S 28°17′E Kafue, 120". */
export function parseCoordLine(line: string): CoordLine | null {
  let lat: number | null = null;
  let lon: number | null = null;
  let rest = line;
  const dms = [...line.matchAll(DMS)];
  if (dms.length >= 2) {
    for (const m of dms.slice(0, 2)) {
      const v = Number(m[1]) + Number(m[2] ?? 0) / 60 + Number(m[3] ?? 0) / 3600;
      const h = m[4].toUpperCase();
      if (h === "N" || h === "S") lat = h === "S" ? -v : v;
      else lon = h === "W" ? -v : v;
      rest = rest.replace(m[0], " ");
    }
  } else {
    const m = line.match(DECIMAL);
    if (m) {
      let a = Number(m[1]);
      let b = Number(m[2]);
      if (Math.abs(a) > 90 && Math.abs(b) <= 90) [a, b] = [b, a];
      lat = a;
      lon = b;
      rest = rest.replace(m[0], " ");
    }
  }
  if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const numbers = rest.match(/[-+]?\d[\d,.]*/g) ?? [];
  const value = numbers.length ? asNumber(numbers[numbers.length - 1]) : null;
  const label = rest.replace(/[-+]?\d[\d,.]*/g, " ").replace(/[,;:|\t()]+/g, " ").replace(/\s+/g, " ").trim();
  return { lat, lon, label, value };
}
