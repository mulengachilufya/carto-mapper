"use client";

import { useEffect, useState } from "react";
import { useCountries } from "@/components/cartography/useCountries";
import { Stepper } from "./Stepper";
import { BriefStep, type ContextFile } from "./BriefStep";
import { LookStep } from "./LookStep";
import type { Place, RawExtract } from "@/lib/mapspec/extract";
import { buildResult } from "@/lib/mapspec/extractTable";
import { BrandStep } from "./BrandStep";
import { PreviewStep } from "./PreviewStep";
import type { ParsedTable, ColumnRoles } from "@/lib/data/parse";
import type { MapSpec, GeoLevel } from "@/lib/mapspec/schema";
import { resolvePlaces, type Resolution } from "@/lib/data/resolve";
import type { Usage } from "@/lib/quota";
import { readBrief } from "@/lib/engine/brief";
import { illustrativeData } from "@/lib/data/illustrative";

interface Brand {
  title: string;
  organisation: string;
  logoDataUrl: string | null;
  notes: string;
}

function recommendType(roles: ColumnRoles | null, prompt: string, resolution: Resolution | null): string {
  const p = prompt.toLowerCase();
  // Region names (countries, provinces, districts) → shade them; sites → mark them.
  const kind = resolution?.reading.kind;
  if (kind === "countries" || kind === "provinces" || kind === "districts") {
    return roles?.valueField ? "choropleth" : "footprint";
  }
  if (roles?.latField && roles?.lonField) {
    if (roles.categoryField) return "categorical_point";
    if (roles.valueField) return "proportional_symbol";
    return "point";
  }
  if (roles?.nameField && roles?.valueField) return "choropleth";
  if (roles?.nameField) return "footprint";
  // No data: follow the engine's reading of the sentence.
  const b = readBrief(prompt);
  if (b.intent === "footprint") return "footprint";
  if (b.intent === "locations") return "point";
  if (b.intent === "thematic") return b.place?.kind === "country" && !b.units ? "proportional_symbol" : "choropleth";
  if (/where we work|footprint|presence|reach|member states|countries we/.test(p)) return "footprint";
  return "reference";
}

export function CreateWizard() {
  const { geo } = useCountries("50m");
  const [step, setStep] = useState(0);

  const [prompt, setPrompt] = useState("");
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [roles, setRoles] = useState<ColumnRoles | null>(null);
  // The engine picks the map type from the data; people pick the look and colours.
  const [mapType, setMapType] = useState<string | null>(null);
  const [look, setLook] = useState<MapSpec["style"] | null>(null);
  const [palette, setPalette] = useState<string | null>(null);
  const [fonts, setFonts] = useState({ title: "Carlito", text: "Carlito" });
  // Sample values the engine asked for when the brief described data it didn't include.
  const [sample, setSample] = useState<{ table: ParsedTable; roles: ColumnRoles } | null>(null);
  const [brand, setBrand] = useState<Brand>({ title: "", organisation: "", logoDataUrl: null, notes: "" });
  const [files, setFiles] = useState<ContextFile[]>([]);
  // Where the data says the map is (e.g. "the counties of Kenya"), found by the resolver.
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [extracting, setExtracting] = useState(false);
  // What the fact-check removed or corrected, shown so nothing changes silently.
  const [checks, setChecks] = useState<string[]>([]);

  const [spec, setSpec] = useState<MapSpec | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [revisionsUsed, setRevisionsUsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Today's free maps, from the server (null when accounts are off).
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/me")
      .then((r) => r.json())
      .then((m: { usage?: Usage | null }) => alive && setUsage(m.usage ?? null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const atLimit = Boolean(usage && usage.remaining <= 0 && !jobId);

  const recommended = recommendType(roles, prompt, resolution);
  const rows = table?.rows ?? sample?.table.rows ?? [];
  const geography: { level: GeoLevel; region?: string } | undefined = resolution
    ? { level: resolution.level, region: resolution.region }
    : undefined;

  async function generate(opts?: { previousSpec?: MapSpec; revisionRequest?: string }) {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry: "custom",
          vibe: prompt,
          table,
          roles,
          mapType,
          mapTypeLocked: false,
          look: opts?.previousSpec ? undefined : look ?? undefined,
          palette: opts?.previousSpec ? undefined : palette ?? undefined,
          fonts: opts?.previousSpec ? undefined : fonts,
          geography,
          title: brand.title || undefined,
          branding: {
            organisation: brand.organisation || undefined,
            logoDataUrl: brand.logoDataUrl || undefined,
            notes: brand.notes || undefined,
          },
          jobId,
          previousSpec: opts?.previousSpec,
          revisionRequest: opts?.revisionRequest,
          revisionCount: opts?.revisionRequest ? revisionsUsed + 1 : revisionsUsed,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (json.usage) setUsage(json.usage as Usage);
      if (res.status === 401) {
        window.location.assign(`/signup?next=${encodeURIComponent("/create")}`);
        return;
      }
      if (res.status === 429) {
        setError(String(json.message ?? "You've reached today's limit."));
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let next = json.spec as MapSpec;
      if (!opts?.previousSpec) {
        // Data the brief itself implied (a list of countries), or illustrative values.
        let s2: { table: ParsedTable; roles: ColumnRoles } | null = null;
        if (!table && Array.isArray(json.rows) && json.rows.length) {
          s2 = { table: { columns: Object.keys(json.rows[0]), rows: json.rows, rowCount: json.rows.length }, roles: { nameField: next.data.nameField } };
        } else if (!table && next.data.illustrative && geo) {
          const ill = await illustrativeData(next, geo).catch(() => null);
          if (ill) {
            s2 = { table: ill.table, roles: ill.roles };
            next = ill.spec;
          }
        }
        setSample(s2);
      }
      setSpec(next);
      setJobId(json.jobId ?? jobId ?? null);
      if (opts?.revisionRequest) setRevisionsUsed((n) => n + 1);
      setStep(3);
    } catch {
      setError("Something went wrong designing the map. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  function stash() {
    if (!spec) return;
    try {
      sessionStorage.setItem(
        "cartomapper:lastMap",
        JSON.stringify({ spec, data: rows, title: spec.title, jobId }),
      );
    } catch {
      /* ignore */
    }
  }

  /** Downloaded: keep the saved copy identical to the file (style, elements, page). */
  function handleDownloaded() {
    stash();
    if (spec && jobId) {
      fetch("/api/job", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, spec }),
      }).catch(() => {});
    }
  }

  async function startMapType() {
    setError(null);
    // Read uploaded reports/articles/images (and a prompt with no structured data) with Claude.
    const needsExtract = files.length > 0 || (prompt.trim().length >= 3 && !table);
    if (needsExtract) {
      setExtracting(true);
      try {
        const res = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, files }),
        });
        if (res.ok) {
          const raw = (await res.json()) as RawExtract;
          let places = raw.places ?? [];
          const notes = [...(raw.checks ?? [])];
          // Places the AI listed from memory go through an independent fact-check first.
          if (raw.pending?.length) {
            const chk = await fetch("/api/extract/check", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prompt, places: raw.pending }),
            }).catch(() => null);
            if (chk?.ok) {
              const c = (await chk.json()) as { places: Place[]; checks: string[] };
              places = places.concat(c.places ?? []);
              notes.push(...(c.checks ?? []));
            } else {
              const certain = new Set(raw.certain ?? []);
              for (const p of raw.pending) {
                if (certain.has(p.name)) places.push(p);
                else notes.push(`Left out "${p.name}": could not double-check it.`);
              }
            }
          }
          setChecks(notes);
          const ex = buildResult({ ...(raw.meta ?? {}), places });
          if (ex.table && ex.roles) {
            // Run what the AI read through the same place resolver as pasted data:
            // geocode the towns and find the geography (e.g. the districts of Uganda).
            const res2 = geo
              ? await resolvePlaces(ex.table as ParsedTable, ex.roles as ColumnRoles, { geo, prompt }).catch(() => null)
              : null;
            setTable(res2?.table ?? (ex.table as ParsedTable));
            setRoles(res2?.roles ?? (ex.roles as ColumnRoles));
            setResolution(res2);
          }
          if (ex.mapType) setMapType((t) => t ?? String(ex.mapType));
        }
      } catch {
        /* extraction is best-effort */
      } finally {
        setExtracting(false);
      }
    }
    setMapType((t) => t ?? recommended);
    setStep(1);
  }

  return (
    <div>
      <Stepper step={step} />

      {usage && (
        <p className="mx-auto mt-5 flex max-w-2xl items-center justify-center gap-2 text-center text-sm text-muted">
          <span className="tabular-nums text-xs">
            {usage.used}/{usage.limit}
          </span>
          free maps used today · changes and downloads don&apos;t count ·{" "}
          <a href="/account" className="underline hover:text-ink">
            My maps
          </a>
        </p>
      )}

      {atLimit && !error && (
        <p className="mx-auto mt-5 max-w-2xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          You&apos;ve made your {usage?.limit} free maps for today. A new one frees up 24 hours after each map. Meanwhile you
          can open, change and download the maps you&apos;ve made from <a href="/account" className="underline">My maps</a>.
        </p>
      )}

      {checks.length > 0 && step >= 1 && step < 3 && (
        <div className="mx-auto mt-5 max-w-2xl rounded-lg border border-line bg-paper-2 px-4 py-3 text-sm text-ink">
          <p className="font-semibold">We double-checked the places before drawing them</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-muted">
            {checks.slice(0, 8).map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p className="mx-auto mt-5 max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-8">
        {step === 0 && (
          <BriefStep
            geo={geo}
            prompt={prompt}
            table={table}
            roles={roles}
            files={files}
            onPromptChange={setPrompt}
            onData={(t, r, res) => {
              setTable(t);
              setRoles(r);
              setResolution(res);
            }}
            onFilesChange={setFiles}
            onNext={startMapType}
            extracting={extracting}
          />
        )}

        {step === 1 && (
          <LookStep
            look={look}
            palette={palette}
            onLook={setLook}
            onPalette={setPalette}
            fonts={fonts}
            onFonts={setFonts}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <BrandStep
            title={brand.title}
            organisation={brand.organisation}
            logoDataUrl={brand.logoDataUrl}
            notes={brand.notes}
            onChange={(patch) => setBrand((b) => ({ ...b, ...patch }))}
            onBack={() => setStep(1)}
            onGenerate={() => generate()}
            generating={generating}
          />
        )}

        {step === 3 && spec && (
          <PreviewStep
            geo={geo}
            spec={spec}
            data={rows}
            setSpec={setSpec}
            onRevise={(text) => generate({ previousSpec: spec, revisionRequest: text })}
            onBack={() => setStep(2)}
            onDownloaded={handleDownloaded}
            revisionsUsed={revisionsUsed}
            busy={generating}
            saved={Boolean(jobId)}
          />
        )}
      </div>
    </div>
  );
}
