"use client";

import { useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import type { FeatureCollection } from "geojson";
import { Button } from "@/components/ui/Button";
import { parseSpreadsheetFile, inferColumns, type ParsedTable, type ColumnRoles } from "@/lib/data/parse";
import { parseAnything } from "@/lib/data/smartParse";
import { resolvePlaces, placesInProse, type PlaceKind, type Resolution } from "@/lib/data/resolve";
import { generateSample } from "@/lib/data/sample";

export interface ContextFile {
  name: string;
  mediaType: string;
  dataBase64: string;
}

interface Props {
  geo: FeatureCollection | null;
  prompt: string;
  table: ParsedTable | null;
  roles: ColumnRoles | null;
  files: ContextFile[];
  onPromptChange: (p: string) => void;
  onData: (table: ParsedTable | null, roles: ColumnRoles | null, resolution: Resolution | null) => void;
  onFilesChange: (files: ContextFile[]) => void;
  onNext: () => void;
  extracting?: boolean;
}

const PROMPT_IDEAS = [
  "Our stores in the United Kingdom, sized by annual sales",
  "Median home price by state, United States, dark style",
  "Where we work in Central America, for our annual report",
  "Our coffee cooperatives in the Colombian highlands",
  "Renewable share of electricity for every country",
];

const PASTE_IDEAS: { label: string; text: string }[] = [
  { label: "A list of places", text: "Tokyo\nLondon\nNew York\nParis\nSão Paulo\nSydney" },
  { label: "A table from Excel", text: "State\tStores\nCalifornia\t812\nTexas\t604\nNew York\t455\nFlorida\t512\nIllinois\t298\nWashington\t240" },
  { label: "Coordinates", text: "Cusco office -13.53, -71.97\nLima HQ -12.05, -77.04\nArequipa depot -16.41, -71.54" },
  { label: "A sentence", text: "In 2025 we opened stores in Berlin, Munich, Hamburg and Cologne, and a pop-up in Frankfurt." },
];

const ROLE_FIELDS: { key: keyof ColumnRoles; label: string }[] = [
  { key: "nameField", label: "Place names" },
  { key: "valueField", label: "Value" },
  { key: "categoryField", label: "Category" },
  { key: "latField", label: "Latitude" },
  { key: "lonField", label: "Longitude" },
];

const KIND_LABEL: Record<PlaceKind, (country?: string) => string> = {
  countries: () => "Countries",
  provinces: (c) => `Provinces / states${c ? ` of ${c}` : ""}`,
  districts: (c) => `Districts${c ? ` of ${c}` : ""}`,
  towns: (c) => `Towns & sites${c ? ` in ${c}` : ""}`,
  coordinates: (c) => `Coordinates${c ? ` in ${c}` : ""}`,
};

const KIND_NOUN: Record<PlaceKind, string> = {
  countries: "countries",
  provinces: "provinces / states",
  districts: "districts",
  towns: "towns & sites",
  coordinates: "locations",
};

function readBase64(file: File): Promise<ContextFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({ name: file.name, mediaType: file.type || "application/octet-stream", dataBase64: String(reader.result).split(",")[1] ?? "" });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function BriefStep({ geo, prompt, table, roles, files, onPromptChange, onData, onFilesChange, onNext, extracting }: Props) {
  const [paste, setPaste] = useState("");
  const [raw, setRaw] = useState<{ table: ParsedTable; roles: ColumnRoles } | null>(null);
  const [prefer, setPrefer] = useState<PlaceKind | undefined>(undefined);
  // A resolution remembers which data + reading it was computed for, so "still
  // resolving" is simply "the latest result is for older input".
  const [resolved, setResolved] = useState<{ src: typeof raw; prefer?: PlaceKind; res: Resolution | null } | null>(null);
  const resolving = Boolean(raw) && (resolved?.src !== raw || resolved?.prefer !== prefer);
  const resolution = resolving ? null : resolved?.res ?? null;
  const [note, setNote] = useState<string | null>(null);

  // Parse the paste box as the user types (tables, lists, coordinates or prose).
  useEffect(() => {
    if (!paste.trim()) return;
    const t = setTimeout(() => {
      const parsed = parseAnything(paste);
      if (parsed && parsed.rowCount) {
        setNote(null);
        setPrefer(undefined);
        setRaw({ table: parsed, roles: inferColumns(parsed) });
      } else if (geo) {
        // Prose: find the places mentioned in it.
        placesInProse(paste, geo).then((names) => {
          if (names.length) {
            const t2: ParsedTable = { columns: ["Place"], rows: names.map((n) => ({ Place: n })), rowCount: names.length };
            setNote(null);
            setRaw({ table: t2, roles: { nameField: "Place" } });
          } else setNote("We couldn't find any places in that text yet. Try a list of names, a table or coordinates.");
        });
      }
    }, 350);
    return () => clearTimeout(t);
  }, [paste, geo]);

  // Work out what the places are, whenever the data, the roles or the chosen reading change.
  useEffect(() => {
    if (!raw || !geo) return;
    let alive = true;
    resolvePlaces(raw.table, raw.roles, { geo, prompt, prefer })
      .catch(() => null)
      .then((res) => {
        if (!alive) return;
        setResolved({ src: raw, prefer, res });
        onData(res?.table ?? raw.table, res?.roles ?? raw.roles, res);
      });
    return () => {
      alive = false;
    };
    // prompt changes shouldn't re-resolve on every keystroke; the Continue step re-reads it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, geo, prefer]);

  const onDrop = async (accepted: File[]) => {
    for (const file of accepted) {
      const name = file.name.toLowerCase();
      if (/\.(csv|tsv|txt|xlsx|xls)$/.test(name)) {
        try {
          const t = name.endsWith(".txt") ? parseAnything(await file.text()) : await parseSpreadsheetFile(file);
          if (t?.rowCount) {
            setPrefer(undefined);
            setRaw({ table: t, roles: inferColumns(t) });
          } else setNote(`${file.name} didn't contain a table we could read.`);
        } catch {
          setNote(`Couldn't read ${file.name}.`);
        }
      } else {
        // Reports, articles, images, sample work → read by the AI when you continue.
        try {
          onFilesChange([...files, await readBase64(file)]);
          setNote(null);
        } catch {
          setNote(`Couldn't read ${file.name}.`);
        }
      }
    }
  };
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: true, noClick: false });

  const makeSample = () => {
    if (!geo) return;
    const s = generateSample(geo, { industry: "research", answers: { geographic_scope: "global", show_what: "values" }, vibe: prompt });
    setPaste("");
    setPrefer(undefined);
    setRaw({ table: s.table, roles: s.roles });
  };

  const clearData = () => {
    setPaste("");
    setRaw(null);
    setResolved(null);
    setPrefer(undefined);
    onData(null, null, null);
  };

  const canContinue = prompt.trim().length >= 3 || !!table || files.length > 0;

  return (
    <div className="space-y-10">
      {/* ── 1. The map in words ── */}
      <section>
        <p className="eyebrow text-accent">Step one</p>
        <h2 className="display mt-2 text-4xl font-semibold text-ink">What should the map show?</h2>
        <p className="mt-2 max-w-2xl text-muted">
          A sentence is enough: the places, the thing you&apos;re measuring, and who it&apos;s for. We&apos;ll work out the rest.
        </p>
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          rows={3}
          placeholder="e.g. Vaccination coverage by district in Uganda, for a donor report"
          className="mt-5 w-full resize-none rounded-lg border border-line bg-paper p-4 text-lg outline-none transition-colors placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {PROMPT_IDEAS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPromptChange(p)}
              className="rounded-full border border-line bg-paper px-3 py-1 text-sm text-muted transition-colors hover:border-accent hover:text-ink"
            >
              {p}
            </button>
          ))}
        </div>
      </section>

      {/* ── 2. Any data ── */}
      <section>
        <p className="eyebrow text-accent">Step two · optional</p>
        <h3 className="display mt-2 text-3xl font-semibold text-ink">Give us your data, in any shape</h3>
        <p className="mt-2 max-w-2xl text-muted">
          Paste a table from Excel, a list of towns, coordinates, or just a paragraph that mentions places. No required
          columns, no required format. We&apos;ll find the places and show you what we understood.
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <div>
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              rows={8}
              placeholder={"Paste anything here…\n\nLondon\t812\nParis\t301\nTokyo\t290"}
              className="w-full rounded-lg border border-line bg-paper p-4 tabular-nums text-sm leading-relaxed outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">Try:</span>
              {PASTE_IDEAS.map((ex) => (
                <button
                  key={ex.label}
                  type="button"
                  onClick={() => setPaste(ex.text)}
                  className="rounded-full border border-line bg-paper px-3 py-0.5 text-muted transition-colors hover:border-accent hover:text-ink"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div
              {...getRootProps()}
              className={`flex flex-1 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-5 py-8 text-center transition-colors ${
                isDragActive ? "border-accent bg-paper-2" : "border-line bg-paper hover:border-accent/60"
              }`}
            >
              <input {...getInputProps()} />
              <p className="font-medium text-ink">Drop files, or click to choose</p>
              <p className="mt-1 text-sm text-muted">
                Spreadsheets (CSV, Excel) · reports (PDF, Word) · photos of a table or an old map
              </p>
            </div>
            <button type="button" onClick={makeSample} disabled={!geo} className="text-sm text-accent underline-offset-4 hover:underline disabled:opacity-50">
              No data yet? Use illustrative sample data
            </button>
          </div>
        </div>

        {files.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {files.map((file, i) => (
              <span key={i} className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1 text-sm">
                <span className="max-w-[220px] truncate">📄 {file.name}</span>
                <span className="text-xs text-muted">read when you continue</span>
                <button type="button" onClick={() => onFilesChange(files.filter((_, j) => j !== i))} className="text-muted hover:text-ink" aria-label="Remove file">
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}

        {note && <p className="mt-3 text-sm text-amber-700">{note}</p>}

        {raw && (
          <DataCard
            resolution={resolution}
            resolving={resolving}
            table={table ?? raw.table}
            roles={roles ?? raw.roles}
            onPrefer={setPrefer}
            onRoles={(r) => {
              setPrefer(undefined);
              setRaw({ table: raw.table, roles: r });
            }}
            onClear={clearData}
          />
        )}
      </section>

      <div className="flex items-center justify-end gap-4 border-t border-line pt-6">
        {!canContinue && <p className="text-sm text-muted">Describe the map or add some data to continue.</p>}
        <Button onClick={onNext} disabled={!canContinue || extracting || resolving} size="lg">
          {extracting ? "Reading your files…" : "Continue →"}
        </Button>
      </div>
    </div>
  );
}

function DataCard({
  resolution,
  resolving,
  table,
  roles,
  onPrefer,
  onRoles,
  onClear,
}: {
  resolution: Resolution | null;
  resolving: boolean;
  table: ParsedTable;
  roles: ColumnRoles;
  onPrefer: (k: PlaceKind) => void;
  onRoles: (r: ColumnRoles) => void;
  onClear: () => void;
}) {
  const r = resolution;
  const shownCols = useMemo(
    () => table.columns.filter((c) => [roles.nameField, roles.valueField, roles.categoryField, roles.latField, roles.lonField].includes(c)).slice(0, 5),
    [table.columns, roles],
  );
  const cols = shownCols.length ? shownCols : table.columns.slice(0, 5);
  const allGood = r && r.reading.matched === r.reading.total;

  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-line bg-paper">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line bg-paper-2/60 px-5 py-4">
        <div>
          <p className="eyebrow text-accent">What we understood</p>
          {resolving || !r ? (
            <p className="mt-1 text-lg font-medium text-ink">Finding your places…</p>
          ) : (
            <p className="mt-1 text-lg font-medium text-ink">
              {r.reading.total} {KIND_NOUN[r.reading.kind]}
              {r.reading.country ? ` ${r.reading.kind === "towns" || r.reading.kind === "coordinates" ? "in" : "of"} ${r.reading.country}` : ""}: {" "}
              <span className={allGood ? "text-emerald-700" : "text-amber-700"}>
                {allGood ? "all found" : `${r.reading.matched} of ${r.reading.total} found`}
              </span>
              {roles.valueField && <span className="text-muted"> · values from “{roles.valueField}”</span>}
            </p>
          )}
        </div>
        <button type="button" onClick={onClear} className="text-sm text-muted hover:text-ink">
          Clear data
        </button>
      </div>

      {r && r.alternatives.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3 text-sm">
          <span className="text-muted">Read these as:</span>
          {[r.reading, ...r.alternatives].map((a) => (
            <button
              key={a.kind}
              type="button"
              onClick={() => onPrefer(a.kind)}
              className={`rounded-full px-3 py-1 transition-colors ${
                a === r.reading ? "bg-accent-2 text-paper" : "border border-line text-muted hover:border-accent hover:text-ink"
              }`}
            >
              {KIND_LABEL[a.kind](a.country)} · {a.matched}
            </button>
          ))}
        </div>
      )}

      <div className="max-h-72 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-paper text-left text-xs text-muted">
            <tr>
              <th className="w-8 px-3 py-2" />
              {cols.map((c) => (
                <th key={c} className="px-3 py-2 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.slice(0, 50).map((row, i) => {
              const ok = r?.rowMatched[i];
              return (
                <tr key={i} className="border-t border-line/70">
                  <td className="px-3 py-1.5 text-center">
                    {r ? (ok ? <span className="text-emerald-600">●</span> : <span className="text-amber-600" title="Not found">○</span>) : null}
                  </td>
                  {cols.map((c) => (
                    <td key={c} className={`px-3 py-1.5 ${typeof row[c] === "number" ? "tabular-nums tabular-nums" : ""}`}>
                      {row[c] === null || row[c] === undefined ? <span className="text-muted/50">·</span> : String(row[c])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {table.rowCount > 50 && <p className="px-5 py-2 text-xs text-muted">…and {table.rowCount - 50} more rows</p>}
      </div>

      {r && r.unmatched.length > 0 && (
        <p className="border-t border-line bg-amber-50/60 px-5 py-3 text-sm text-amber-800">
          Not found: {r.unmatched.slice(0, 12).join(", ")}
          {r.unmatched.length > 12 ? ` and ${r.unmatched.length - 12} more` : ""}. Check the spelling, or try another
          reading above. These stay off the map.
        </p>
      )}

      <details className="border-t border-line px-5 py-3 text-sm">
        <summary className="cursor-pointer text-muted hover:text-ink">Adjust which column is which</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {ROLE_FIELDS.map((f) => (
            <label key={f.key}>
              <span className="text-muted">{f.label}</span>
              <select
                value={(roles[f.key] as string) ?? ""}
                onChange={(e) => onRoles({ ...roles, [f.key]: e.target.value || undefined })}
                className="mt-1 w-full rounded-md border border-line bg-paper px-2 py-1.5 outline-none focus:border-accent"
              >
                <option value="">None</option>
                {table.columns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}
