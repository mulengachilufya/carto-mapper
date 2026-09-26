"use client";

import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import { useCountries } from "@/components/cartography/useCountries";
import { Stepper } from "./Stepper";
import { BriefStep, type ContextFile } from "./BriefStep";
import { MapTypeStep } from "./MapTypeStep";
import { BrandStep } from "./BrandStep";
import { PreviewStep } from "./PreviewStep";
import { getSessionId } from "@/lib/session";
import type { ParsedTable, ColumnRoles } from "@/lib/data/parse";
import type { MapSpec, GeoLevel } from "@/lib/mapspec/schema";
import { resolvePlaces, type Resolution } from "@/lib/data/resolve";

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
  const [creditedBanner, setCreditedBanner] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // What this deployment can do (payments on/off), from the server — never assumed.
  const [paymentEnabled, setPaymentEnabled] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/config")
      .then((r) => r.json())
      .then((c: { payments?: boolean }) => alive && setPaymentEnabled(Boolean(c.payments)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("credited") === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time init from the URL on mount
      setCreditedBanner(true);
    }
  }, []);

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
          sessionId: getSessionId(),
          jobId,
          previousSpec: opts?.previousSpec,
          revisionRequest: opts?.revisionRequest,
          revisionCount: opts?.revisionRequest ? revisionsUsed + 1 : revisionsUsed,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setSpec(json.spec as MapSpec);
      // Every map gets an id, even without a database (Stripe verifies it on return).
      setJobId(json.jobId ?? jobId ?? `local-${nanoid(12)}`);
      if (json.newJob) {
        setNotice("Your paid map already used its included revision, so this change was saved as a new map. The paid one is still on your download page.");
      }
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

  async function handleCheckout() {
    if (!spec) return;
    stash();
    const sessionId = getSessionId();
    try {
      // Freeze the design exactly as approved (style, elements, page) on the job.
      if (jobId) {
        await fetch("/api/job", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId, sessionId, spec }),
        }).catch(() => {});
      }
      // A pack credit on this session? Spend it and skip Stripe entirely.
      const creditRes = await fetch(`/api/credits?sessionId=${encodeURIComponent(sessionId)}`);
      const creditJson = (await creditRes.json()) as { remaining?: number };
      if (jobId && (creditJson.remaining ?? 0) > 0) {
        const consumeRes = await fetch("/api/credits/consume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, jobId }),
        });
        if (consumeRes.ok) {
          window.location.assign(`/download?job=${encodeURIComponent(jobId)}&paid=1`);
          return;
        }
        // Fall through to normal checkout if the credit spend lost a race.
      }

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, sessionId, title: spec.title }),
      });
      const json = await res.json();
      if (json.url) {
        window.location.assign(json.url);
        return;
      }
      throw new Error(json.error ?? "no checkout url");
    } catch (e) {
      setError(e instanceof Error && e.message !== "no checkout url" ? e.message : "Couldn't start checkout. Please try again.");
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

      {creditedBanner && (
        <p className="mx-auto mt-5 max-w-2xl rounded-lg border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm text-accent-2">
          Pack purchased — your credits are ready. Build a map below and checkout will skip straight to download.
        </p>
      )}

      {notice && (
        <p className="mx-auto mt-5 max-w-2xl rounded-lg border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm text-accent-2">
          {notice}
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
            onPay={handleCheckout}
            revisionsUsed={revisionsUsed}
            busy={generating}
            paymentEnabled={paymentEnabled}
          />
        )}
      </div>
    </div>
  );
}
