import {
  schemeBlues,
  schemeGreens,
  schemeGreys,
  schemeOranges,
  schemePurples,
  schemeReds,
  schemeBuGn,
  schemeBuPu,
  schemeGnBu,
  schemeOrRd,
  schemePuBu,
  schemePuBuGn,
  schemePuRd,
  schemeRdPu,
  schemeYlGn,
  schemeYlGnBu,
  schemeYlOrBr,
  schemeYlOrRd,
  schemeBrBG,
  schemePRGn,
  schemePiYG,
  schemePuOr,
  schemeRdBu,
  schemeRdGy,
  schemeRdYlBu,
  schemeSpectral,
  schemeDark2,
  schemeSet2,
  schemeTableau10,
  schemePaired,
} from "d3-scale-chromatic";
import type { PaletteKind } from "@/lib/mapspec/schema";

type Indexed = readonly (readonly string[])[];
type Flat = readonly string[];

interface PaletteDef {
  kind: PaletteKind;
  scheme: Indexed | Flat;
}

/**
 * Curated ColorBrewer palettes only — the schemes professional cartographers
 * actually reach for. No rainbow ramps, no neon. Sequential for one-directional
 * quantitative data, diverging for data around a meaningful midpoint, qualitative
 * for categories.
 */
const REGISTRY: Record<string, PaletteDef> = {
  // Sequential — single hue
  Blues: { kind: "sequential", scheme: schemeBlues },
  Greens: { kind: "sequential", scheme: schemeGreens },
  Greys: { kind: "sequential", scheme: schemeGreys },
  Oranges: { kind: "sequential", scheme: schemeOranges },
  Purples: { kind: "sequential", scheme: schemePurples },
  Reds: { kind: "sequential", scheme: schemeReds },
  // Sequential — multi hue
  BuGn: { kind: "sequential", scheme: schemeBuGn },
  BuPu: { kind: "sequential", scheme: schemeBuPu },
  GnBu: { kind: "sequential", scheme: schemeGnBu },
  OrRd: { kind: "sequential", scheme: schemeOrRd },
  PuBu: { kind: "sequential", scheme: schemePuBu },
  PuBuGn: { kind: "sequential", scheme: schemePuBuGn },
  PuRd: { kind: "sequential", scheme: schemePuRd },
  RdPu: { kind: "sequential", scheme: schemeRdPu },
  YlGn: { kind: "sequential", scheme: schemeYlGn },
  YlGnBu: { kind: "sequential", scheme: schemeYlGnBu },
  YlOrBr: { kind: "sequential", scheme: schemeYlOrBr },
  YlOrRd: { kind: "sequential", scheme: schemeYlOrRd },
  // Diverging
  BrBG: { kind: "diverging", scheme: schemeBrBG },
  PRGn: { kind: "diverging", scheme: schemePRGn },
  PiYG: { kind: "diverging", scheme: schemePiYG },
  PuOr: { kind: "diverging", scheme: schemePuOr },
  RdBu: { kind: "diverging", scheme: schemeRdBu },
  RdGy: { kind: "diverging", scheme: schemeRdGy },
  RdYlBu: { kind: "diverging", scheme: schemeRdYlBu },
  Spectral: { kind: "diverging", scheme: schemeSpectral },
  // Qualitative
  Dark2: { kind: "qualitative", scheme: schemeDark2 },
  Set2: { kind: "qualitative", scheme: schemeSet2 },
  Tableau10: { kind: "qualitative", scheme: schemeTableau10 },
  Paired: { kind: "qualitative", scheme: schemePaired },
};

export const PALETTES_BY_KIND: Record<PaletteKind, string[]> = {
  sequential: [
    "Blues", "Greens", "BuGn", "YlGnBu", "YlGn", "PuBu", "BuPu", "GnBu",
    "PuBuGn", "OrRd", "YlOrBr", "YlOrRd", "RdPu", "PuRd", "Purples", "Greys",
    "Reds", "Oranges",
  ],
  diverging: ["RdBu", "BrBG", "PuOr", "RdYlBu", "PRGn", "PiYG", "RdGy", "Spectral"],
  qualitative: ["Dark2", "Set2", "Tableau10", "Paired"],
};

export function paletteKind(name: string): PaletteKind {
  return REGISTRY[name]?.kind ?? "sequential";
}

/** Discrete colours for a classed map. Clamped to a sensible 3–9 class range. */
export function getPaletteColors(name: string, classes: number, reverse = false): string[] {
  const def = REGISTRY[name] ?? REGISTRY.Blues;
  let colors: string[];
  if (def.kind === "qualitative") {
    const flat = def.scheme as Flat;
    colors = flat.slice(0, Math.max(1, classes)) as string[];
    while (colors.length < classes) colors = colors.concat(flat as string[]);
    colors = colors.slice(0, classes);
  } else {
    const idx = def.scheme as Indexed;
    const k = Math.max(3, Math.min(9, classes));
    const arr = idx[k] ?? idx[idx.length - 1];
    colors = [...arr];
  }
  return reverse ? colors.reverse() : colors;
}

/** A sensible default palette for a kind. */
export function recommendPalette(kind: PaletteKind): string {
  return PALETTES_BY_KIND[kind][0];
}
