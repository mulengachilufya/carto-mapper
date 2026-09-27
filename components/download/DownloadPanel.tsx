"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CartoMap } from "@/components/cartography/CartoMap";
import { useCountries } from "@/components/cartography/useCountries";
import { useSubdivisions } from "@/components/cartography/useSubdivisions";
import { exportSvgToPdf, pagePt } from "@/lib/pdf-client";
import { downloadSvgFile } from "@/lib/svg-download";
import type { MapSpec } from "@/lib/mapspec/schema";
import type { Row } from "@/lib/data/parse";

interface Stash {
  spec: MapSpec;
  data: Row[];
  title: string;
  jobId?: string | null;
}

/** A saved map, ready to download again: this tab's copy, else the one in the user's account. */
export function DownloadPanel() {
  const { geo } = useCountries("50m");
  const exportRef = useRef<HTMLDivElement>(null);
  const [stash, setStash] = useState<Stash | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subdivisions = useSubdivisions(stash?.spec, geo);

  useEffect(() => {
    const urlJob = new URLSearchParams(window.location.search).get("job");
    let local: Stash | null = null;
    try {
      const raw = sessionStorage.getItem("cartomapper:lastMap");
      if (raw) local = JSON.parse(raw) as Stash;
    } catch {
      /* ignore */
    }
    if (local && (!urlJob || local.jobId === urlJob)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time init from sessionStorage on mount
      setStash(local);
      setLoaded(true);
      return;
    }
    if (!urlJob) {
      setLoaded(true);
      return;
    }
    fetch(`/api/job?jobId=${encodeURIComponent(urlJob)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setStash({ spec: j.spec, data: j.data, title: j.title, jobId: j.jobId }))
      .finally(() => setLoaded(true));
  }, []);

  async function downloadPdf() {
    const svg = exportRef.current?.querySelector("svg");
    if (!stash || !svg) return;
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

  function downloadSvg() {
    const svg = exportRef.current?.querySelector("svg");
    if (stash && svg) downloadSvgFile(svg as SVGSVGElement, stash.title);
  }

  if (!loaded) return null;

  if (!stash) {
    return (
      <div className="plate text-center">
        <div className="p-8">
          <h1 className="display text-3xl font-semibold text-ink">We couldn&apos;t find that map</h1>
          <p className="mt-3 text-muted">It may have been removed. Your saved maps are all on your maps page.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button href="/account" variant="secondary">
              My maps
            </Button>
            <Button href="/create">Make a map</Button>
          </div>
        </div>
      </div>
    );
  }

  const pdf = pagePt(stash.spec.page);
  const landscape = stash.spec.page.orientation === "landscape";
  const W = landscape ? 880 : 620;
  const H = Math.round(landscape ? W / Math.SQRT2 : W * Math.SQRT2);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-atlas-leather">Ready to print</p>
          <h1 className="display mt-2 text-3xl font-semibold text-ink sm:text-4xl">{stash.title}</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={downloadSvg} disabled={!geo} variant="secondary">
            SVG for designers
          </Button>
          <Button onClick={downloadPdf} disabled={busy || !geo} size="lg">
            {busy ? "Preparing your PDF…" : !geo ? "Loading…" : "Download PDF"}
          </Button>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      <div className="mt-6 overflow-hidden rounded-xl border border-line bg-paper shadow-sm">
        {geo ? (
          <CartoMap spec={stash.spec} data={stash.data} geo={geo} subdivisions={subdivisions} width={W} height={H} className="h-auto w-full" />
        ) : (
          <div className="aspect-[3/2] w-full animate-pulse bg-paper-2" />
        )}
      </div>

      <div className="mt-6 flex flex-wrap justify-between gap-3">
        <Button href="/account" variant="ghost">
          ← My maps
        </Button>
        <Button href="/create" variant="secondary">
          Make another map
        </Button>
      </div>

      {/* The print copy, with PDF-safe fonts. */}
      {geo && (
        <div ref={exportRef} aria-hidden style={{ position: "fixed", left: -99999, top: 0, opacity: 0, pointerEvents: "none" }}>
          <CartoMap spec={stash.spec} data={stash.data} geo={geo} subdivisions={subdivisions} width={pdf.w} height={pdf.h} forPdf />
        </div>
      )}
    </div>
  );
}
