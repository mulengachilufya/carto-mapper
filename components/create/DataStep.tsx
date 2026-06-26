"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";
import type { FeatureCollection } from "geojson";
import { Button } from "@/components/ui/Button";
import {
  parseSpreadsheetFile,
  parsePastedText,
  inferColumns,
  type ParsedTable,
  type ColumnRoles,
} from "@/lib/data/parse";
import { generateSample } from "@/lib/data/sample";

export type DataMode = "upload" | "paste" | "sample";

interface Props {
  geo: FeatureCollection | null;
  industryId: string;
  answers: Record<string, string>;
  vibe: string;
  table: ParsedTable | null;
  roles: ColumnRoles | null;
  onData: (table: ParsedTable, roles: ColumnRoles, mode: DataMode) => void;
  onRolesChange: (roles: ColumnRoles) => void;
  onBack: () => void;
  onNext: () => void;
  generating: boolean;
}

const TABS: { id: DataMode; label: string }[] = [
  { id: "upload", label: "Upload file" },
  { id: "paste", label: "Paste data" },
  { id: "sample", label: "Generate sample" },
];

export function DataStep(props: Props) {
  const { geo, table, roles, onData, onRolesChange, onBack, onNext, generating } = props;
  const [tab, setTab] = useState<DataMode>("upload");
  const [paste, setPaste] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = (t: ParsedTable, mode: DataMode) => {
    if (!t.columns.length || !t.rowCount) {
      setError("That didn't look like a table with a header row. Try again?");
      return;
    }
    setError(null);
    onData(t, inferColumns(t), mode);
  };

  const onDrop = async (files: File[]) => {
    if (!files[0]) return;
    try {
      load(await parseSpreadsheetFile(files[0]), "upload");
    } catch {
      setError("Couldn't read that file. CSV or Excel (.xlsx) work best.");
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      "text/csv": [".csv"],
      "text/plain": [".txt"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
  });

  const makeSample = () => {
    if (!geo) return;
    const { table: t, roles: r } = generateSample(geo, {
      industry: props.industryId,
      answers: props.answers,
      vibe: props.vibe,
    });
    setError(null);
    onData(t, r, "sample");
  };

  return (
    <div>
      <h2 className="font-serif text-2xl font-semibold tracking-tight">Add your data</h2>
      <p className="mt-1.5 text-muted">Upload a spreadsheet, paste a table, or generate a realistic sample to see how it looks.</p>

      <div className="mt-5 inline-flex rounded-full border border-line bg-paper p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
              tab === t.id ? "bg-accent text-white" : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "upload" && (
          <div
            {...getRootProps()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
              isDragActive ? "border-accent bg-paper-2" : "border-line hover:border-accent/60"
            }`}
          >
            <input {...getInputProps()} />
            <p className="font-medium">Drop a CSV or Excel file here</p>
            <p className="mt-1 text-sm text-muted">or click to browse · first row should be column headers</p>
          </div>
        )}

        {tab === "paste" && (
          <div>
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              rows={7}
              placeholder={"Country, Value\nKenya, 1200\nUganda, 940\nTanzania, 1530"}
              className="w-full rounded-xl border border-line bg-paper p-3.5 font-mono text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
            <div className="mt-2">
              <Button variant="secondary" size="sm" onClick={() => load(parsePastedText(paste), "paste")}>
                Use this data
              </Button>
            </div>
          </div>
        )}

        {tab === "sample" && (
          <div className="rounded-xl border border-line bg-paper-2 px-6 py-10 text-center">
            <p className="font-medium">No data handy? We'll generate a realistic sample.</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              Based on your answers — points placed inside the right country, or values across countries.
            </p>
            <div className="mt-4">
              <Button onClick={makeSample} disabled={!geo}>
                {geo ? "Generate sample data" : "Loading map data…"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {table && roles && (
        <DataPreview table={table} roles={roles} onRolesChange={onRolesChange} />
      )}

      <div className="mt-8 flex items-center justify-between">
        <Button onClick={onBack} variant="ghost">← Back</Button>
        <Button onClick={onNext} disabled={!table || generating} size="lg">
          {generating ? "Designing your map…" : "Generate my map"}
        </Button>
      </div>
    </div>
  );
}

const ROLE_FIELDS: { key: keyof ColumnRoles; label: string }[] = [
  { key: "nameField", label: "Place / region name" },
  { key: "valueField", label: "Value (the metric)" },
  { key: "latField", label: "Latitude" },
  { key: "lonField", label: "Longitude" },
  { key: "categoryField", label: "Category" },
];

function DataPreview({
  table,
  roles,
  onRolesChange,
}: {
  table: ParsedTable;
  roles: ColumnRoles;
  onRolesChange: (r: ColumnRoles) => void;
}) {
  return (
    <div className="mt-6 rounded-xl border border-line bg-paper p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{table.rowCount} rows · {table.columns.length} columns</p>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-line text-muted">
              {table.columns.map((c) => (
                <th key={c} className="whitespace-nowrap py-1.5 pr-4 font-medium">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.slice(0, 4).map((row, i) => (
              <tr key={i} className="border-b border-line/60">
                {table.columns.map((c) => (
                  <td key={c} className="whitespace-nowrap py-1.5 pr-4 text-ink">{String(row[c] ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ROLE_FIELDS.map((f) => (
          <label key={f.key} className="text-sm">
            <span className="text-muted">{f.label}</span>
            <select
              value={(roles[f.key] as string) ?? ""}
              onChange={(e) => onRolesChange({ ...roles, [f.key]: e.target.value || undefined })}
              className="mt-1 w-full rounded-lg border border-line bg-paper px-2.5 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="">— none —</option>
              {table.columns.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}
