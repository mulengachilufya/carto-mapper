"use client";

import { useMemo, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";
import { Button } from "@/components/ui/Button";
import { CartoMap } from "@/components/cartography/CartoMap";
import { buildNameIndex, matchFeature } from "@/lib/cartography/geo";
import { parseMapSpec, type MapSpec, type Furniture } from "@/lib/mapspec/schema";
import type { Row } from "@/lib/data/parse";

interface Props {
  geo: FeatureCollection | null;
  spec: MapSpec;
  data: Row[];
  setSpec: (spec: MapSpec) => void;
  onRevise: (text: string) => void;
  onBack: () => void;
  onPay: () => void;
  revisionsUsed: number;
  busy: boolean;
  paymentEnabled: boolean;
}

const FURNITURE_TOGGLES: { key: keyof Furniture; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "legend", label: "Legend" },
  { key: "scalebar", label: "Scale bar" },
  { key: "north_arrow", label: "North arrow" },
  { key: "graticule", label: "Graticule" },
  { key: "caption", label: "Caption" },
  { key: "source", label: "Source line" },
];

export function PreviewStep({ geo, spec, data, setSpec, onRevise, onBack, onPay, revisionsUsed, busy, paymentEnabled }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [revision, setRevision] = useState("");

  const landscape = spec.page.orientation === "landscape";
  const W = landscape ? 880 : 620;
  const H = Math.round(landscape ? W / Math.SQRT2 : W * Math.SQRT2);

  // For choropleths, how many place names actually matched a country?
  const coverage = useMemo(() => {
    if (!geo || spec.mapType !== "choropleth" || !spec.data.nameField) return null;
    const idx = buildNameIndex(geo);
    const seen = new Set<string>();
    let matched = 0;
    for (const row of data) {
      const nm = row[spec.data.nameField];
      if (nm == null) continue;
      const key = String(nm);
      if (seen.has(key)) continue;
      seen.add(key);
      if (matchFeature(key, idx)) matched++;
    }
    return { total: seen.size, matched };
  }, [geo, spec.mapType, spec.data.nameField, data]);

  const setFurniture = (key: keyof Furniture, value: boolean) =>
    setSpec(parseMapSpec({ ...spec, furniture: { ...spec.furniture, [key]: value } }));

  const setPage = (patch: Partial<MapSpec["page"]>) =>
    setSpec(parseMapSpec({ ...spec, page: { ...spec.page, ...patch } }));

  const downloadSvg = () => {
    const svg = frameRef.current?.querySelector("svg");
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const str = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([str], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug(spec.title)}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const applyRevision = () => {
    if (revision.trim()) {
      onRevise(revision.trim());
      setRevision("");
    }
  };

  return (
    <div>
      <h2 className="font-serif text-2xl font-semibold tracking-tight">Your map</h2>
      <p className="mt-1.5 text-[--color-muted]">Toggle elements, tweak the page, or ask for a change. Looks good? Get the print-ready PDF.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Map */}
        <div>
          <div ref={frameRef} className="overflow-hidden rounded-xl border border-[--color-line] bg-[--color-paper] shadow-sm">
            {geo ? (
              <CartoMap spec={spec} data={data} geo={geo} width={W} height={H} className="h-auto w-full" />
            ) : (
              <div className="aspect-[3/2] w-full animate-pulse bg-[--color-paper-2]" />
            )}
          </div>
          {coverage && coverage.matched < coverage.total && (
            <p className="mt-2 text-[13px] text-amber-700">
              Matched {coverage.matched} of {coverage.total} place names — unmatched places stay uncoloured (shown as “No data”). Check spelling or try full country names.
            </p>
          )}
        </div>

        {/* Controls */}
        <aside className="space-y-6">
          <Panel title="Map elements">
            <div className="space-y-2">
              {FURNITURE_TOGGLES.map((t) => (
                <Toggle key={t.key} label={t.label} checked={spec.furniture[t.key]} onChange={(v) => setFurniture(t.key, v)} />
              ))}
            </div>
          </Panel>

          <Panel title="Page">
            <div className="space-y-3">
              <Segmented
                value={spec.page.orientation}
                options={[
                  { value: "landscape", label: "Landscape" },
                  { value: "portrait", label: "Portrait" },
                ]}
                onChange={(v) => setPage({ orientation: v as MapSpec["page"]["orientation"] })}
              />
              <Segmented
                value={spec.page.size}
                options={[
                  { value: "A4", label: "A4" },
                  { value: "Letter", label: "Letter" },
                ]}
                onChange={(v) => setPage({ size: v as MapSpec["page"]["size"] })}
              />
            </div>
          </Panel>

          <Panel title="Ask for a change">
            <textarea
              value={revision}
              onChange={(e) => setRevision(e.target.value)}
              rows={3}
              placeholder='e.g. "make it green", "remove the north arrow", "use natural breaks"'
              className="w-full resize-none rounded-lg border border-[--color-line] bg-[--color-paper] p-2.5 text-sm outline-none focus:border-[--color-accent] focus:ring-1 focus:ring-[--color-accent]"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-[--color-muted]">
                {revisionsUsed === 0 ? "1 free revision included" : `${revisionsUsed} revision${revisionsUsed > 1 ? "s" : ""} used`}
              </span>
              <Button variant="secondary" size="sm" onClick={applyRevision} disabled={busy || !revision.trim()}>
                {busy ? "Working…" : "Apply"}
              </Button>
            </div>
          </Panel>
        </aside>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <Button onClick={onBack} variant="ghost">← Back</Button>
        <div className="flex items-center gap-3">
          <Button onClick={downloadSvg} variant="secondary">Download SVG</Button>
          <Button onClick={onPay} size="lg" disabled={busy}>
            {paymentEnabled ? "Looks good — get my PDF ($5)" : "Looks good — download my PDF"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[--color-line] bg-[--color-paper] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[--color-muted]">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between text-sm">
      <span>{label}</span>
      <span className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-[--color-accent]" : "bg-[--color-line]"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? "left-[1.125rem]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex w-full rounded-lg border border-[--color-line] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm transition-colors ${
            value === o.value ? "bg-[--color-accent] text-white" : "text-[--color-muted] hover:text-[--color-ink]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cartomapper-map";
}
