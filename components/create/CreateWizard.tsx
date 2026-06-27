"use client";

import { useState } from "react";
import { useCountries } from "@/components/cartography/useCountries";
import { Stepper } from "./Stepper";
import { BriefStep } from "./BriefStep";
import { MapTypeStep } from "./MapTypeStep";
import { BrandStep } from "./BrandStep";
import { PreviewStep } from "./PreviewStep";
import { getSessionId } from "@/lib/session";
import type { ParsedTable, ColumnRoles } from "@/lib/data/parse";
import type { MapSpec } from "@/lib/mapspec/schema";

interface Brand {
  title: string;
  organisation: string;
  logoDataUrl: string | null;
  notes: string;
}

function recommendType(roles: ColumnRoles | null, prompt: string): string {
  const p = prompt.toLowerCase();
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

function titleFromPrompt(p: string): string {
  const s = p.trim().replace(/\s+/g, " ");
  if (!s) return "Untitled Map";
  const first = s.split(/[.!?\n]/)[0];
  const words = first.split(" ").slice(0, 8).join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function CreateWizard() {
  const { geo } = useCountries("50m");
  const [step, setStep] = useState(0);

  const [prompt, setPrompt] = useState("");
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [roles, setRoles] = useState<ColumnRoles | null>(null);
  const [mapType, setMapType] = useState<string | null>(null);
  const [brand, setBrand] = useState<Brand>({ title: "", organisation: "", logoDataUrl: null, notes: "" });

  const [spec, setSpec] = useState<MapSpec | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [revisionsUsed, setRevisionsUsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const paymentEnabled = Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  const recommended = recommendType(roles, prompt);

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
      if (json.jobId) setJobId(json.jobId);
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
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, sessionId: getSessionId(), title: spec.title }),
      });
      const json = await res.json();
      if (json.url) {
        window.location.assign(json.url);
        return;
      }
      throw new Error(json.error ?? "no checkout url");
    } catch {
      setError("Couldn't start checkout — check the Stripe keys in your environment.");
    }
  }

  function startMapType() {
    setBrand((b) => (b.title ? b : { ...b, title: titleFromPrompt(prompt) }));
    setMapType((t) => t ?? recommended);
    setStep(1);
  }

  return (
    <div>
      <Stepper step={step} />

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
            onPromptChange={setPrompt}
            onData={(t, r) => {
              setTable(t);
              setRoles(r);
            }}
            onNext={startMapType}
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
