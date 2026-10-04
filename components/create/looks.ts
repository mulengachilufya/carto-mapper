import type { MapSpec } from "@/lib/mapspec/schema";

/** The six looks, with a swatch that hints at each. */
export const LOOKS: { id: MapSpec["style"]; label: string; hint: string; swatch: string }[] = [
  { id: "editorial", label: "Editorial", hint: "Flat & bold", swatch: "linear-gradient(135deg,#e3e7e5 0 45%,#c0614f 45% 70%,#8b2e26 70%)" },
  { id: "night", label: "Night", hint: "Dark & glowing", swatch: "radial-gradient(circle at 60% 45%,#fff1c2 0,#ff9a3c 18%,#17221f 55%)" },
  { id: "dots", label: "Dots", hint: "Dot matrix", swatch: "radial-gradient(circle,#1f5c4d 38%,transparent 42%) 0 0/7px 7px,#ffffff" },
  { id: "atlas", label: "Atlas", hint: "Physical relief", swatch: "linear-gradient(135deg,#b9dbee 0 30%,#cfe2b0 30% 60%,#c79a6b 60%)" },
  { id: "classic", label: "Classic", hint: "Political pastels", swatch: "linear-gradient(135deg,#f3d9a4 0 33%,#cfe2b0 33% 66%,#f2c7c0 66%)" },
  { id: "minimal", label: "Minimal", hint: "Paper & ink", swatch: "linear-gradient(135deg,#faf7ef 0 50%,#d9d3c4 50%)" },
];

/** Colour schemes people pick by feel, each a ramp the renderer knows. */
export const COLOURS: { id: string; label: string }[] = [
  { id: "Greens", label: "Forest" },
  { id: "Blues", label: "Ocean" },
  { id: "OrRd", label: "Ember" },
  { id: "YlOrRd", label: "Sunset" },
  { id: "YlOrBr", label: "Gold" },
  { id: "RdPu", label: "Berry" },
  { id: "Purples", label: "Violet" },
  { id: "GnBu", label: "Lagoon" },
  { id: "PuBuGn", label: "Glacier" },
  { id: "Greys", label: "Ink" },
];
