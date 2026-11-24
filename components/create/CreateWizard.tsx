"use client";

import { useEffect, useState } from "react";
import { useCountries } from "@/components/cartography/useCountries";
import { Stepper } from "./Stepper";
import { BriefStep, type ContextFile } from "./BriefStep";
import { LookStep } from "./LookStep";
import type { RawExtract } from "@/lib/mapspec/extract";
import { buildResult } from "@/lib/mapspec/extractTable";
import { BrandStep } from "./BrandStep";
import { PreviewStep } from "./PreviewStep";
import type { ParsedTable, ColumnRoles } from "@/lib/data/parse";
import type { MapSpec, GeoLevel } from "@/lib/mapspec/schema";
import { resolvePlaces, type Resolution } from "@/lib/data/resolve";
import type { Usage } from "@/lib/quota";
import { readBrief } from "@/lib/engine/brief";
import { Button } from "@/components/ui/Button";

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
  const [extractionDraft, setExtractionDraft] = useState<RawExtract | null>(null);

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
      if (res.status === 422) {
        setError(String(json.message));
        setStep(0);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const next = json.spec as MapSpec;
      if (!opts?.previousSpec) {
        // Country names supplied explicitly in a footprint brief.
        let s2: { table: ParsedTable; roles: ColumnRoles } | null = null;
        if (!table && Array.isArray(json.rows) && json.rows.length) {
          s2 = { table: { columns: Object.keys(json.rows[0]), rows: json.rows, rowCount: json.rows.length }, roles: { nameField: next.data.nameField } };
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
    if (!table && files.length) {
      setExtracting(true);
      try {
        const res = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, files }),
        });
        if (!res.ok) throw new Error("Extraction failed");
        const draft = (await res.json()) as RawExtract;
        if (!draft.places?.length) {
          setError("I couldn't read any usable records from the files. Paste a list or upload a table.");
          return;
        }
        setExtractionDraft(draft);
      } catch {
        setError("I couldn't read the attachments. Try again or upload a table.");
      } finally {
        setExtracting(false);
      }
      return;
    }
    setMapType((t) => t ?? recommended);
    setStep(1);
  }

  async function acceptExtraction(draft: RawExtract) {
    const result = buildResult({ ...draft.meta, places: draft.places });
    if (!result.table || !result.roles) return;
    setExtracting(true);
    try {
      const resolved = geo
        ? await resolvePlaces(result.table, result.roles, { geo, prompt }).catch(() => null)
        : null;
      setTable(resolved?.table ?? result.table);
      setRoles(resolved?.roles ?? result.roles);
      setResolution(resolved);
      setMapType(result.mapType ?? null);
      setExtractionDraft(null);
      setStep(1);
    } finally {
      setExtracting(false);
    }
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

      {error && (
        <p className="mx-auto mt-5 max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-8">
        {step === 0 && extractionDraft && (
          <section className="mx-auto max-w-3xl">
            <h2 className="display text-3xl font-semibold text-ink">Review extracted records</h2>
            <p className="mt-2 text-muted">Compare the places and values with your files before using them on a map.</p>
            {extractionDraft.checks?.map((check) => <p key={check} className="mt-2 text-sm text-muted">{check}</p>)}
            <ul className="mt-4 max-h-96 divide-y divide-line overflow-auto rounded-lg border border-line">
              {extractionDraft.places.map((place, index) => (
                <li key={index} className="px-4 py-3">
                  <p className="font-medium text-ink">
                    {[place.name, place.value, place.category, place.lat != null && place.lon != null ? `${place.lat}, ${place.lon}` : null]
                      .filter((value) => value != null).join(" · ")}
                  </p>
                  <p className="mt-1 text-sm text-muted">{place.file} · {place.evidence}</p>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex justify-between gap-3">
              <Button variant="ghost" disabled={extracting} onClick={() => setExtractionDraft(null)}>Back to files</Button>
              <Button disabled={extracting} onClick={() => acceptExtraction(extractionDraft)}>Use these records</Button>
            </div>
          </section>
        )}
        {step === 0 && !extractionDraft && (
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
