"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CartoMap } from "@/components/cartography/CartoMap";
import { useCountries } from "@/components/cartography/useCountries";
import { exportSvgToPdf, pagePt } from "@/lib/pdf-client";
import type { MapSpec } from "@/lib/mapspec/schema";
import type { Row } from "@/lib/data/parse";

interface Stash {
  spec: MapSpec;
  data: Row[];
  title: string;
  jobId?: string | null;
}

export function DownloadPanel() {
  const { geo } = useCountries("50m");
  const exportRef = useRef<HTMLDivElement>(null);
  const [stash, setStash] = useState<Stash | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("cartomapper:lastMap");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time init from sessionStorage on mount
      if (raw) setStash(JSON.parse(raw) as Stash);
    } catch {
      /* ignore */
    }
    setPaid(new URLSearchParams(window.location.search).get("paid") === "1");
    setLoaded(true);
  }, []);

  async function downloadPdf() {
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

  if (!loaded) return null;

  if (!stash) {
    return (
      <div className="rounded-2xl border border-line bg-paper p-8 text-center">
        <h1 className="font-serif text-2xl font-semibold">We couldn't find your map</h1>
        <p className="mt-2 text-muted">
          Maps are tied to the browser tab you created them in. If you've closed it, you can make a new one in a minute.
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
      <span className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent-2">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        {paid ? "Payment received — thank you!" : "Your map is ready"}
      </span>
      <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight">{stash.title}</h1>
      <p className="mt-2 text-muted">Download your print-ready PDF below. You can re-download while this tab stays open.</p>

      <div className="mt-6 flex flex-col items-center gap-3">
        <Button onClick={downloadPdf} disabled={busy || !geo} size="lg">
          {busy ? "Preparing your PDF…" : !geo ? "Loading…" : "Download PDF"}
        </Button>
        {error && <p className="max-w-md text-sm text-red-600">{error}</p>}
        <Button href="/create" variant="ghost">
          Create another map
        </Button>
      </div>

      {/* Hidden, print-font copy used only for client-side PDF export */}
      {geo && (
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
