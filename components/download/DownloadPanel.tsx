"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { MapSpec } from "@/lib/mapspec/schema";
import type { Row } from "@/lib/data/parse";

interface Stash {
  spec: MapSpec;
  data: Row[];
  title: string;
  jobId?: string | null;
}

export function DownloadPanel() {
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
    if (!stash) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec: stash.spec, data: stash.data }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${stash.title}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(
        `Couldn't render the PDF in this environment (${e instanceof Error ? e.message : "error"}). On a server with Chromium available this runs automatically.`,
      );
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;

  if (!stash) {
    return (
      <div className="rounded-2xl border border-[--color-line] bg-[--color-paper] p-8 text-center">
        <h1 className="font-serif text-2xl font-semibold">We couldn't find your map</h1>
        <p className="mt-2 text-[--color-muted]">
          Maps are tied to the browser tab you created them in. If you've closed it, you can make a new one in a minute.
        </p>
        <div className="mt-6">
          <Button href="/create">Create a map</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[--color-line] bg-[--color-paper] p-8 text-center shadow-sm">
      <span className="inline-flex items-center gap-2 rounded-full bg-[--color-accent]/10 px-3 py-1 text-xs font-medium text-[--color-accent-2]">
        <span className="h-1.5 w-1.5 rounded-full bg-[--color-accent]" />
        {paid ? "Payment received — thank you!" : "Your map is ready"}
      </span>
      <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight">{stash.title}</h1>
      <p className="mt-2 text-[--color-muted]">Download your print-ready PDF below. You can re-download while this tab stays open.</p>

      <div className="mt-6 flex flex-col items-center gap-3">
        <Button onClick={downloadPdf} disabled={busy} size="lg">
          {busy ? "Preparing your PDF…" : "Download PDF"}
        </Button>
        {error && <p className="max-w-md text-sm text-red-600">{error}</p>}
        <Button href="/create" variant="ghost">
          Create another map
        </Button>
      </div>
    </div>
  );
}
