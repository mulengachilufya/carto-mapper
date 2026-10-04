"use client";

import { useState } from "react";
import Link from "next/link";
import type { JobSummary } from "@/lib/jobs";

const STYLE_SWATCH: Record<string, string> = {
  editorial: "linear-gradient(135deg,#e3dfd6 0 45%,#c0614f 45% 70%,#8b2e26 70%)",
  night: "radial-gradient(circle at 60% 45%,#fff1c2 0,#ff9a3c 14%,#17221f 50%)",
  dots: "radial-gradient(circle,#1f5c4d 38%,transparent 42%) 0 0/8px 8px,#f6f1e7",
  atlas: "linear-gradient(135deg,#a9c9a0 0%,#e8d9a6 45%,#c79a6b 75%,#9fc3d6 100%)",
  classic: "linear-gradient(135deg,#f3d9b1 0%,#cfe0b4 35%,#f1c6c3 65%,#bcd6ea 100%)",
  minimal: "linear-gradient(135deg,#f5f1e8 0%,#d9d3c4 60%,#8a8171 100%)",
};

const TYPE_LABEL: Record<string, string> = {
  choropleth: "Shaded regions",
  footprint: "Highlighted regions",
  proportional_symbol: "Sized circles",
  graduated_symbol: "Graduated symbols",
  dot: "Dot density",
  point: "Locations",
  categorical_point: "Locations by category",
};

export function MapList({ maps: initial }: { maps: JobSummary[] }) {
  const [maps, setMaps] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function remove(m: JobSummary) {
    if (!window.confirm(`Remove "${m.title}" from your maps?`)) return;
    const res = await fetch(`/api/job?jobId=${encodeURIComponent(m.id)}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) setMaps((all) => all.filter((x) => x.id !== m.id));
    else setError("Couldn't remove that map. Please try again.");
  }

  if (maps.length === 0) {
    return (
      <div className="mt-10 rounded-xl border border-dashed border-atlas-rule px-6 py-16 text-center">
        <p className="display text-2xl font-semibold text-atlas-ink">No maps yet</p>
        <p className="mt-2 text-atlas-ink-2">Your maps are saved here as you make them, ready to download again any time.</p>
      </div>
    );
  }

  return (
    <>
      {error && <p className="mt-6 text-sm text-red-700">{error}</p>}
      <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {maps.map((m) => (
          <li key={m.id} className="group overflow-hidden rounded-xl border border-atlas-rule bg-atlas-card transition-shadow hover:shadow-md">
            <Link href={`/download?job=${encodeURIComponent(m.id)}`} className="block">
              <div className="h-24" style={{ background: STYLE_SWATCH[m.style ?? "editorial"] ?? STYLE_SWATCH.editorial }} />
              <div className="p-5">
                <p className="display line-clamp-2 text-lg font-semibold leading-snug text-atlas-ink group-hover:text-atlas-moss">{m.title}</p>
                <p className="mt-1.5 text-sm text-atlas-ink-2">
                  {[m.region, m.mapType ? TYPE_LABEL[m.mapType] ?? m.mapType : null].filter(Boolean).join(" · ")}
                </p>
              </div>
            </Link>
            <div className="flex items-center justify-between border-t border-atlas-rule px-5 py-3 text-xs text-atlas-ink-2">
              <time dateTime={m.created_at}>
                {new Date(m.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
              </time>
              <span className="flex gap-4">
                <Link href={`/download?job=${encodeURIComponent(m.id)}`} className="font-medium text-atlas-moss hover:underline">
                  Download
                </Link>
                <button type="button" onClick={() => remove(m)} className="hover:text-red-700">
                  Remove
                </button>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
