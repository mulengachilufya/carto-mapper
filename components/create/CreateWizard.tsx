"use client";

import { useState } from "react";
import { useCountries } from "@/components/cartography/useCountries";
import { Stepper } from "./Stepper";
import { IndustryStep } from "./IndustryStep";
import { QuestionsStep } from "./QuestionsStep";
import { DataStep, type DataMode } from "./DataStep";
import { PreviewStep } from "./PreviewStep";
import { getSessionId } from "@/lib/session";
import type { ParsedTable, ColumnRoles } from "@/lib/data/parse";
import type { MapSpec } from "@/lib/mapspec/schema";

export function CreateWizard() {
  const { geo } = useCountries("50m");
  const [step, setStep] = useState(0);

  const [industryId, setIndustryId] = useState<string | null>(null);
  const [customIndustry, setCustomIndustry] = useState("");
  const [vibe, setVibe] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [roles, setRoles] = useState<ColumnRoles | null>(null);
  const [, setDataMode] = useState<DataMode | null>(null);

  const [spec, setSpec] = useState<MapSpec | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [revisionsUsed, setRevisionsUsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const paymentEnabled = Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

  async function generate(opts?: { previousSpec?: MapSpec; revisionRequest?: string }) {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry: industryId,
          customIndustry,
          answers,
          vibe,
          table,
          roles,
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

  async function handlePay() {
    if (!spec) return;
    stash();
    if (paymentEnabled) {
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
    } else {
      await downloadPdf();
    }
  }

  async function downloadPdf() {
    if (!spec) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec, data: table?.rows ?? [] }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${spec.title}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(
        `PDF export needs Chrome available to the server. Use "Download SVG" for now. (${
          e instanceof Error ? e.message : "error"
        })`,
      );
    } finally {
      setGenerating(false);
    }
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
          <IndustryStep
            industryId={industryId}
            customIndustry={customIndustry}
            vibe={vibe}
            onChange={(patch) => {
              if (patch.industryId !== undefined) {
                setIndustryId(patch.industryId);
                setAnswers({});
              }
              if (patch.customIndustry !== undefined) setCustomIndustry(patch.customIndustry);
              if (patch.vibe !== undefined) setVibe(patch.vibe);
            }}
            onNext={() => setStep(1)}
          />
        )}

        {step === 1 && industryId && (
          <QuestionsStep
            industryId={industryId}
            answers={answers}
            onChange={setAnswers}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && industryId && (
          <DataStep
            geo={geo}
            industryId={industryId}
            answers={answers}
            vibe={vibe}
            table={table}
            roles={roles}
            onData={(t, r, mode) => {
              setTable(t);
              setRoles(r);
              setDataMode(mode);
            }}
            onRolesChange={setRoles}
            onBack={() => setStep(1)}
            onNext={() => generate()}
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
            onPay={handlePay}
            revisionsUsed={revisionsUsed}
            busy={generating}
            paymentEnabled={paymentEnabled}
          />
        )}
      </div>
    </div>
  );
}
