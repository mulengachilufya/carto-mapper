"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CartoMap } from "@/components/cartography/CartoMap";
import { useCountries } from "@/components/cartography/useCountries";
import { exportSvgToPdf, pagePt } from "@/lib/pdf-client";
import { getSessionId } from "@/lib/session";
import type { MapSpec } from "@/lib/mapspec/schema";
import type { Row } from "@/lib/data/parse";

interface Stash {
  spec: MapSpec;
  data: Row[];
  title: string;
  jobId?: string | null;
}

type Gate = "checking" | "ok" | "blocked" | "check-failed";

export function DownloadPanel() {
  const { geo } = useCountries("50m");
  const exportRef = useRef<HTMLDivElement>(null);
  const [stash, setStash] = useState<Stash | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [gate, setGate] = useState<Gate>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load whatever the wizard stashed, plus the job id from either the stash
  // or the ?job= param Stripe redirects back with.
  useEffect(() => {
    let stashedJobId: string | null = null;
    try {
      const raw = sessionStorage.getItem("cartomapper:lastMap");
      if (raw) {
        const parsed = JSON.parse(raw) as Stash;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time init from sessionStorage on mount
        setStash(parsed);
        stashedJobId = parsed.jobId ?? null;
      }
    } catch {
      /* ignore */
    }
    const urlJobId = new URLSearchParams(window.location.search).get("job");
    setJobId(stashedJobId ?? urlJobId ?? null);
    setLoaded(true);
  }, []);

  // The actual gate: ask the server whether this job is paid. Never trust the
  // ?paid=1 URL param — it's just there for a nicer success-page message.
  useEffect(() => {
    if (!loaded) return;
    if (!jobId) {
      // No job on record at all — nothing in Supabase to check against, which
      // only happens with Stripe/Supabase unconfigured (local dev). Don't block.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time gate resolution on mount
      setGate("ok");
      return;
    }
    let cancelled = false;
    fetch(`/api/job-status?jobId=${encodeURIComponent(jobId)}`)
      .then((r) => r.json())
      .then((d: { paid?: boolean }) => {
        if (!cancelled) setGate(d.paid ? "ok" : "blocked");
      })
      .catch(() => {
        if (!cancelled) setGate("check-failed");
      });
    return () => {
      cancelled = true;
    };
  }, [loaded, jobId]);

  async function downloadPdf() {
    if (gate !== "ok") return; // belt and suspenders — button is disabled anyway
    const svg = exportRef.current?.querySelector("svg");
    if (!stash || !svg) {
      setError("The map isn't ready yet — give it a second and try again.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await exportSvgToPdf(svg as SVGSVGElement, stash.spec.page, stash.title);
    } catch (e) {
      setError(`Couldn't generate the PDF (${e instanceof Error ? e.message : "error"}). Please try again.`);
    } finally {
      setBusy(false);
    }
  }

  async function resumeCheckout() {
    if (!jobId || !stash) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, sessionId: getSessionId(), title: stash.title }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) window.location.href = data.url;
      else setError(data.error ?? "Couldn't start checkout.");
    } catch {
      setError("Couldn't start checkout. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;

  if (!stash) {
    return (
      <div className="rounded-2xl border border-line bg-paper p-8 text-center">
        <h1 className="font-serif text-2xl font-semibold">We couldn't find your map</h1>
        <p className="mt-2 text-muted">
          Maps are tied to the browser tab you created them in. If you've closed it, you can make a new one in a
          minute.
        </p>
        <div className="mt-6">
          <Button href="/create">Create a map</Button>
        </div>
      </div>
    );
  }

  const pdf = pagePt(stash.spec.page);

  return (
    <div className="rounded-2xl border border-line bg-paper p-8 text-center shadow-sm">
      <span
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
          gate === "ok" ? "bg-accent/10 text-accent-2" : "bg-amber-100 text-amber-800"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${gate === "ok" ? "bg-accent" : "bg-amber-500"}`} />
        {gate === "checking" && "Confirming your payment…"}
        {gate === "ok" && "Payment received — thank you!"}
        {gate === "blocked" && "Payment required"}
        {gate === "check-failed" && "Couldn't confirm payment"}
      </span>
      <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight">{stash.title}</h1>

      {gate === "blocked" && (
        <p className="mt-2 text-muted">
          This map hasn't been paid for yet, so the download is locked. Finish checkout to unlock the PDF.
        </p>
      )}
      {gate === "check-failed" && (
        <p className="mt-2 text-muted">We couldn't reach the server to confirm your payment. Try again in a moment.</p>
      )}
      {gate === "ok" && (
        <p className="mt-2 text-muted">Download your print-ready PDF below. You can re-download while this tab stays open.</p>
      )}

      <div className="mt-6 flex flex-col items-center gap-3">
        {gate === "ok" && (
          <Button onClick={downloadPdf} disabled={busy || !geo} size="lg">
            {busy ? "Preparing your PDF…" : !geo ? "Loading…" : "Download PDF"}
          </Button>
        )}
        {gate === "blocked" && (
          <Button onClick={resumeCheckout} disabled={busy} size="lg">
            {busy ? "Redirecting…" : "Complete payment — $5"}
          </Button>
        )}
        {gate === "check-failed" && (
          <Button onClick={() => setGate("checking")} size="lg">
            Try again
          </Button>
        )}
        {gate === "checking" && (
          <Button disabled size="lg">
            Confirming…
          </Button>
        )}
        {error && <p className="max-w-md text-sm text-red-600">{error}</p>}
        <Button href="/create" variant="ghost">
          Create another map
        </Button>
      </div>

      {/* Hidden, print-font copy used only for client-side PDF export */}
      {geo && gate === "ok" && (
        <div
          ref={exportRef}
          aria-hidden
          style={{ position: "fixed", left: -99999, top: 0, opacity: 0, pointerEvents: "none" }}
        >
          <CartoMap spec={stash.spec} data={stash.data} geo={geo} width={pdf.w} height={pdf.h} forPdf />
        </div>
      )}
    </div>
  );
}
