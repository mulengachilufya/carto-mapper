"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CartoMap } from "@/components/cartography/CartoMap";
import { useCountries } from "@/components/cartography/useCountries";
import { useSubdivisions } from "@/components/cartography/useSubdivisions";
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

interface Gate {
  status: string;
  paid: boolean;
  payments: "on" | "off";
  watermark: boolean;
}

const WATERMARK = "Preview · CartoMapper";

export function DownloadPanel() {
  const { geo } = useCountries("50m");
  const exportRef = useRef<HTMLDivElement>(null);
  const [stash, setStash] = useState<Stash | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [gate, setGate] = useState<Gate | null>(null);
  const [gateError, setGateError] = useState(false);
  const [waited, setWaited] = useState(0);
  const [busy, setBusy] = useState(false);
  const [delivered, setDelivered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subdivisions = useSubdivisions(stash?.spec, geo);

  // 1. Find the map: this tab's copy first, else the saved copy on the server.
  useEffect(() => {
    const urlJob = new URLSearchParams(window.location.search).get("job");
    let local: Stash | null = null;
    try {
      const raw = sessionStorage.getItem("cartomapper:lastMap");
      if (raw) local = JSON.parse(raw) as Stash;
    } catch {
      /* ignore */
    }
    const id = urlJob ?? local?.jobId ?? null;
    if (local && (!urlJob || local.jobId === urlJob)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time init from sessionStorage on mount
      setStash(local);
      setJobId(id);
      setLoaded(true);
      return;
    }
    if (!id) {
      setLoaded(true);
      return;
    }
    fetch(`/api/job?jobId=${encodeURIComponent(id)}&sessionId=${encodeURIComponent(getSessionId())}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setStash({ spec: j.spec, data: j.data, title: j.title, jobId: j.jobId }))
      .finally(() => {
        setJobId(id);
        setLoaded(true);
      });
  }, []);

  // 2. The gate — asked of the server (and, via ?cs=, of Stripe). While a payment is
  //    still being confirmed (webhook in flight) keep asking for up to ~40 seconds.
  useEffect(() => {
    if (!loaded || !jobId) return;
    let alive = true;
    const cs = new URLSearchParams(window.location.search).get("cs") ?? "";
    fetch(`/api/job-status?jobId=${encodeURIComponent(jobId)}${cs ? `&cs=${encodeURIComponent(cs)}` : ""}`)
      .then((r) => r.json())
      .then((g: Gate) => {
        if (!alive) return;
        setGate(g);
        setGateError(false);
        if (!g.paid && g.payments === "on" && (g.status === "checkout" || cs) && waited < 20) {
          setTimeout(() => alive && setWaited((w) => w + 1), 2000);
        }
      })
      .catch(() => alive && setGateError(true));
    return () => {
      alive = false;
    };
  }, [loaded, jobId, waited]);

  const canDownload = Boolean(gate && (gate.paid || gate.payments === "off"));
  const watermark = gate && !gate.paid ? WATERMARK : undefined;

  function markDelivered() {
    if (!jobId || !gate?.paid || delivered) return;
    setDelivered(true);
    fetch("/api/job-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, event: "delivered" }),
    }).catch(() => {});
  }

  async function downloadPdf() {
    const svg = exportRef.current?.querySelector("svg");
    if (!stash || !svg || !canDownload) return;
    setBusy(true);
    setError(null);
    try {
      await exportSvgToPdf(svg as SVGSVGElement, stash.spec.page, stash.title);
      markDelivered();
    } catch (e) {
      setError(`Couldn't generate the PDF (${e instanceof Error ? e.message : "error"}). Please try again.`);
    } finally {
      setBusy(false);
    }
  }

  function downloadSvg() {
    const svg = exportRef.current?.querySelector("svg");
    if (!stash || !svg || !canDownload) return;
    const str = new XMLSerializer().serializeToString(svg);
    const url = URL.createObjectURL(new Blob([str], { type: "image/svg+xml;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${stash.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "map"}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    markDelivered();
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
      <div className="plate text-center">
        <div className="p-8">
          <h1 className="display text-3xl font-semibold text-ink">We couldn&apos;t find that map</h1>
          <p className="mt-3 text-muted">
            Maps are saved to the browser you made them in. If you paid on another device, open the link from that
            browser — or make a new map in a couple of minutes.
          </p>
          <div className="mt-6">
            <Button href="/create">Make a map</Button>
          </div>
        </div>
      </div>
    );
  }

  const pdf = pagePt(stash.spec.page);
  const confirming = Boolean(gate && !gate.paid && gate.payments === "on" && gate.status === "checkout" && waited < 20);
  const steps = [
    { label: "Designed", done: true, pending: false },
    { label: gate?.payments === "off" ? "Payments off" : "Paid", done: Boolean(gate?.paid), pending: confirming },
    { label: "Ready", done: canDownload, pending: false },
    { label: "Downloaded", done: delivered || gate?.status === "delivered", pending: false },
  ];

  return (
    <div className="plate">
      <div className="p-8">
        <ol className="flex items-center justify-between gap-2 text-xs">
          {steps.map((s, i) => (
            <li key={s.label} className="flex flex-1 items-center gap-2 last:flex-none">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  s.done ? "bg-accent text-paper" : s.pending ? "animate-pulse border-2 border-accent" : "border border-line text-muted"
                }`}
              >
                {s.done ? "✓" : i + 1}
              </span>
              <span className={s.done ? "text-ink" : "text-muted"}>{s.label}</span>
              {i < steps.length - 1 && <span className={`h-px flex-1 ${s.done ? "bg-accent" : "bg-line"}`} />}
            </li>
          ))}
        </ol>

        <h1 className="display mt-8 text-center text-3xl font-semibold text-ink">{stash.title}</h1>

        <p className="mx-auto mt-3 max-w-md text-center text-muted">
          {gateError && "We couldn't reach the server to check your payment. Try again in a moment."}
          {!gateError && !gate && "Checking your map…"}
          {!gateError && confirming && "Confirming your payment with Stripe — this usually takes a few seconds."}
          {!gateError && gate?.paid && "Paid — thank you. Your clean, print-ready files are below. You can come back to this page to download them again."}
          {!gateError && gate?.payments === "off" && "Payments aren't switched on for this site yet, so these downloads carry a preview mark."}
          {!gateError && gate && !gate.paid && gate.payments === "on" && !confirming && gate.status === "refunded" && "This map was refunded, so its download is locked."}
          {!gateError && gate && !gate.paid && gate.payments === "on" && !confirming && gate.status !== "refunded" && "This map hasn't been paid for yet. Finish checkout to unlock the clean files."}
        </p>

        <div className="mt-7 flex flex-col items-center gap-3">
          {canDownload && (
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={downloadPdf} disabled={busy || !geo} size="lg">
                {busy ? "Preparing your PDF…" : !geo ? "Loading…" : gate?.paid ? "Download PDF (print)" : "Download watermarked PDF"}
              </Button>
              <Button onClick={downloadSvg} disabled={!geo} variant="secondary" size="lg">
                {gate?.paid ? "SVG for designers" : "Watermarked SVG"}
              </Button>
            </div>
          )}
          {gate && !canDownload && !confirming && gate.status !== "refunded" && (
            <Button onClick={resumeCheckout} disabled={busy} size="lg">
              {busy ? "Opening checkout…" : "Complete payment — $5"}
            </Button>
          )}
          {gateError && (
            <Button onClick={() => setWaited((w) => w + 1)} size="lg">
              Try again
            </Button>
          )}
          {error && <p className="max-w-md text-center text-sm text-red-700">{error}</p>}
          <Button href="/create" variant="ghost">
            Make another map
          </Button>
        </div>
      </div>

      {/* The print copy: PDF fonts, and the watermark unless paid. */}
      {geo && canDownload && (
        <div ref={exportRef} aria-hidden style={{ position: "fixed", left: -99999, top: 0, opacity: 0, pointerEvents: "none" }}>
          <CartoMap
            spec={stash.spec}
            data={stash.data}
            geo={geo}
            subdivisions={subdivisions}
            width={pdf.w}
            height={pdf.h}
            watermark={watermark}
            forPdf
          />
        </div>
      )}
    </div>
  );
}
