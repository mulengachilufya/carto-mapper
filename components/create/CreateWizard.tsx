"use client";

import { useEffect, useState } from "react";
import { useCountries } from "@/components/cartography/useCountries";
import { Stepper } from "./Stepper";
import { BriefStep, type ContextFile } from "./BriefStep";
import { MapTypeStep } from "./MapTypeStep";
import { BrandStep } from "./BrandStep";
import { PreviewStep } from "./PreviewStep";
import type { ParsedTable, ColumnRoles } from "@/lib/data/parse";
import type { MapSpec, GeoLevel } from "@/lib/mapspec/schema";
import { resolvePlaces, type Resolution } from "@/lib/data/resolve";
import type { Usage } from "@/lib/quota";

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
  if (/where we work|footprint|presence|reach|member states|countries we/.test(p)) return "footprint";
  if (/site|location|clinic|office|borehole|facility|where are/.test(p)) return "point";
  return "choropleth";
}

const titleCase = (s: string) =>
  s
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\w\S*/g, (w, i: number) => (i > 0 && /^(of|and|by|in|the|per|for|a|an)$/i.test(w) ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1)));

/**
 * A map title the way an atlas would print it. With data: "Schools by County, Kenya"
 * from the value and place columns. Otherwise the prompt, trimmed of the audience
 * ("…, for a donor report") and politely capitalised.
 */
function titleFromData(prompt: string, roles: ColumnRoles | null, resolution: Resolution | null): string {
  const region = resolution?.region && resolution.region !== "World" ? resolution.region.replace("United States of America", "United States") : undefined;
  const generic = /^(value|values|count|total|number|column \d+|place|name)$/i;
  if (roles?.valueField && roles.nameField && !generic.test(roles.valueField)) {
    const unit = generic.test(roles.nameField)
      ? { countries: "Country", provinces: "Province", districts: "District", towns: "Site", coordinates: "Site" }[resolution?.reading.kind ?? "towns"]
      : roles.nameField.replace(/s$/i, "");
    return `${titleCase(roles.valueField)} by ${titleCase(unit)}${region && resolution?.level !== "world" ? `, ${region}` : ""}`;
  }
  const s = prompt
    .trim()
    .replace(/\s+/g, " ")
    .split(/[.!?\n]/)[0]
    // Drop the audience: "…, annual report 2026", "… for a donor briefing", "… for our board deck".
    .replace(/,?\s+(?:for\s+)?(?:(?:a|an|the|our|my)\s+)?(?:annual|donor|board|quarterly|ministry|internal|client|funding)?\s*(?:report|briefing|deck|presentation|slides?|article|paper|thesis|newsletter|proposal)\b.*$/i, "")
    .replace(/,?\s+(for|in order to|to be used in|to use in)\s+(a|an|the|our|my)\b.*$/i, "");
  if (!s) return region ? `Map of ${region}` : "Untitled Map";
  return titleCase(s.split(" ").slice(0, 10).join(" "));
}

export function CreateWizard() {
  const { geo } = useCountries("50m");
  const [step, setStep] = useState(0);

  const [prompt, setPrompt] = useState("");
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [roles, setRoles] = useState<ColumnRoles | null>(null);
  const [mapType, setMapType] = useState<string | null>(null);
  const [brand, setBrand] = useState<Brand>({ title: "", organisation: "", logoDataUrl: null, notes: "" });
  const [files, setFiles] = useState<ContextFile[]>([]);
  // Where the data says the map is (e.g. "the counties of Kenya"), found by the resolver.
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [extracting, setExtracting] = useState(false);

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
      setSpec(json.spec as MapSpec);
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
        JSON.stringify({ spec, data: table?.rows ?? [], title: spec.title, jobId }),
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
          const ex = await res.json();
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
          if (ex.title) setBrand((b) => (b.title ? b : { ...b, title: String(ex.title) }));
          if (ex.mapType) setMapType((t) => t ?? String(ex.mapType));
        }
      } catch {
        /* extraction is best-effort */
      } finally {
        setExtracting(false);
      }
    }
    setBrand((b) => (b.title ? b : { ...b, title: titleFromData(prompt, roles, resolution) }));
    setMapType((t) => t ?? recommended);
    setStep(1);
  }

  return (
    <div>
      <Stepper step={step} />

      {usage && (
        <p className="mx-auto mt-5 flex max-w-2xl items-center justify-center gap-2 text-center text-sm text-muted">
          <span className="font-mono text-xs">
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
          You&apos;ve made your {usage?.limit} free maps for today. A new one frees up 24 hours after each map — meanwhile you
          can open, change and download the maps you&apos;ve made from <a href="/account" className="underline">My maps</a>.
        </p>
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
          <MapTypeStep
            geo={geo}
            selected={mapType}
            recommended={recommended}
            onSelect={setMapType}
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
            data={table?.rows ?? []}
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
