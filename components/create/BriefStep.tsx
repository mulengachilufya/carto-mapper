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

interface Props {
  geo: FeatureCollection | null;
  prompt: string;
  table: ParsedTable | null;
  roles: ColumnRoles | null;
  onPromptChange: (p: string) => void;
  onData: (table: ParsedTable | null, roles: ColumnRoles | null) => void;
  onNext: () => void;
}

const ROLE_FIELDS: { key: keyof ColumnRoles; label: string }[] = [
  { key: "nameField", label: "Place / region" },
  { key: "valueField", label: "Value" },
  { key: "latField", label: "Latitude" },
  { key: "lonField", label: "Longitude" },
  { key: "categoryField", label: "Category" },
];

type Tab = "upload" | "paste" | "sample";

export function BriefStep({ geo, prompt, table, roles, onPromptChange, onData, onNext }: Props) {
  const [tab, setTab] = useState<Tab>("upload");
  const [paste, setPaste] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const load = (t: ParsedTable) => {
    if (!t.columns.length || !t.rowCount) {
      setNote("That didn't look like a table with a header row.");
      return;
    }
    setNote(null);
    onData(t, inferColumns(t));
  };

  const onDrop = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".txt")) {
      try {
        load(await parseSpreadsheetFile(file));
      } catch {
        setNote("Couldn't read that file.");
      }
    } else {
      // PDF / Word / etc. — full document reading arrives with AI extraction (next update).
      setNote(`Got "${file.name}". Reading full reports (PDF/Word) turns on with AI extraction — coming next. For now use the prompt, a CSV/Excel, or paste.`);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false });

  const makeSample = () => {
    if (!geo) return;
    const { table: t, roles: r } = generateSample(geo, { industry: "research", answers: { geographic_scope: "global", show_what: "values" }, vibe: prompt });
    setNote(null);
    onData(t, r);
  };

  return (
    <div>
      <h2 className="font-serif text-2xl font-semibold tracking-tight">Describe the map you want</h2>
      <p className="mt-1.5 text-muted">One or two sentences. Add data if you have it — or let us generate a sample.</p>

      <div className="mt-5 rounded-xl border border-accent/30 bg-accent/5 p-4 text-sm">
        <span className="font-semibold text-accent-2">Tip — mention three things:</span>{" "}
        <span className="text-ink">the <strong>places</strong>, the <strong>metric</strong>, and the <strong>message</strong>.</span>
        <span className="block text-muted">e.g. &ldquo;Show our 7 project districts in Zambia&apos;s Copperbelt, shaded by number of beneficiaries, for a donor report.&rdquo;</span>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        rows={4}
        placeholder="Describe your map…"
        className="mt-4 w-full resize-none rounded-xl border border-line bg-paper p-4 text-[15px] outline-none focus:border-accent focus:ring-1 focus:ring-accent"
      />

      <div className="mt-6">
        <div className="mb-3 inline-flex rounded-full border border-line bg-paper p-1">
          {([["upload", "Upload"], ["paste", "Paste"], ["sample", "Generate sample"]] as [Tab, string][]).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors ${tab === id ? "bg-accent text-white" : "text-muted hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "upload" && (
          <div
            {...getRootProps()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
              isDragActive ? "border-accent bg-paper-2" : "border-line hover:border-accent/60"
            }`}
          >
            <input {...getInputProps()} />
            <p className="font-medium">Drop a file here</p>
            <p className="mt-1 text-sm text-muted">CSV or Excel read instantly · reports (PDF/Word) once extraction is on</p>
          </div>
        )}

        {tab === "paste" && (
          <div>
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              rows={6}
              placeholder={"Country, Value\nKenya, 1200\nUganda, 940"}
              className="w-full rounded-xl border border-line bg-paper p-3.5 font-mono text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
            <div className="mt-2">
              <Button variant="secondary" size="sm" onClick={() => load(parsePastedText(paste))}>Use this data</Button>
            </div>
          </div>
        )}

        {tab === "sample" && (
          <div className="rounded-xl border border-line bg-paper-2 px-6 py-8 text-center">
            <p className="font-medium">No data yet? We&apos;ll generate a realistic sample.</p>
            <div className="mt-3">
              <Button onClick={makeSample} disabled={!geo}>{geo ? "Generate sample data" : "Loading…"}</Button>
            </div>
          </div>
        )}
      </div>

      {note && <p className="mt-3 text-sm text-amber-700">{note}</p>}

      {table && roles && (
        <div className="mt-5 rounded-xl border border-line bg-paper p-4">
          <p className="text-sm font-medium">{table.rowCount} rows · {table.columns.length} columns</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ROLE_FIELDS.map((f) => (
              <label key={f.key} className="text-sm">
                <span className="text-muted">{f.label}</span>
                <select
                  value={(roles[f.key] as string) ?? ""}
                  onChange={(e) => onData(table, { ...roles, [f.key]: e.target.value || undefined })}
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
      )}

      <div className="mt-8 flex justify-end">
        <Button onClick={onNext} disabled={prompt.trim().length < 3 && !table} size="lg">Continue</Button>
      </div>
    </div>
  );
}
