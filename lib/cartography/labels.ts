import { geoCentroid, geoContains, geoPath, type GeoPermissibleObjects, type GeoProjection } from "d3-geo";
import type { GeoLevel } from "@/lib/mapspec/schema";
import type { AtlasLayers } from "@/lib/cartography/atlas";
import { mainParts, type CountryFeature } from "@/lib/cartography/geo";

export type Rect = { x: number; y: number; w: number; h: number };

export interface MapLabel {
  x: number;
  y: number;
  text: string;
  size: number;
  role: "country" | "focus-city" | "city" | "ocean" | "sea" | "lake" | "peak" | "region";
  anchor: "start" | "middle" | "end";
  letterSpacing?: number; // em
  marker?: { x: number; y: number; kind: "capital" | "provincial" | "town" | "peak" };
}

export interface LabelOptions {
  projection: GeoProjection;
  frame: Rect;
  k: number;
  level: GeoLevel;
  countries: CountryFeature[];
  focus?: CountryFeature;
  layers: AtlasLayers | null;
  /** Areas labels must stay clear of (legend, north arrow, scale bar, data symbols). */
  obstacles: Rect[];
  /** Data symbols to keep clear of. */
  circles: { cx: number; cy: number; r: number }[];
  /** Fewer, quieter reference labels when the map carries its own point labels. */
  quiet?: boolean;
  countryLabels?: boolean;
}

// Rough glyph width, matching the renderer's box sizing.
const textW = (s: string, size: number, spacing = 0) => s.length * size * (0.56 + spacing);
const hit = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export function placeAtlasLabels(o: LabelOptions): MapLabel[] {
  const { projection, frame, k, level, layers } = o;
  const path = geoPath(projection);
  const placed: Rect[] = [...o.obstacles];
  const circles = o.circles.map((c) => ({ x: c.cx - c.r, y: c.cy - c.r, w: 2 * c.r, h: 2 * c.r }));
  const inner: Rect = { x: frame.x + 5 * k, y: frame.y + 5 * k, w: frame.w - 10 * k, h: frame.h - 10 * k };
  const inside = (r: Rect) => r.x >= inner.x && r.y >= inner.y && r.x + r.w <= inner.x + inner.w && r.y + r.h <= inner.y + inner.h;
  const labels: MapLabel[] = [];
  const project = (lon: number, lat: number) => {
    const p = projection([lon, lat]);
    if (!p || !Number.isFinite(p[0])) return null;
    const back = projection.invert?.(p);
    // Reject points on the far side of the globe / outside clipped projections.
    if (!back || Math.abs(back[0] - lon) > 0.5 || Math.abs(back[1] - lat) > 0.5) return null;
    return p;
  };
  const tryPlace = (label: MapLabel, box: Rect, avoidCircles = true) => {
    if (!inside(box) || placed.some((p) => hit(p, box)) || (avoidCircles && circles.some((c) => hit(c, box)))) return false;
    placed.push(box);
    labels.push(label);
    return true;
  };
  const centred = (x: number, y: number, text: string, size: number, spacing = 0, lines = 1): Rect => {
    const w = textW(text, size, spacing);
    return { x: x - w / 2, y: y - size * 0.8, w, h: size * (1.05 + (lines - 1) * 1.1) };
  };

  const isWorld = level === "world";
  const isContinent = level === "continent";
  const local = !isWorld && !isContinent;
  const scaleBudget = (frame.w * frame.h) / (600 * 420);

  // ── Oceans first: they anchor a small-scale map ──
  const marine = layers?.marine ?? [];
  const maxMarineRank = isWorld ? 1 : isContinent ? 3 : 5;
  for (const [name, lon, lat, rank, kind] of marine) {
    if (kind !== "ocean" || rank > maxMarineRank || (isWorld && lat < -60)) continue;
    const p = project(lon, lat);
    if (!p) continue;
    const size = (isWorld ? 10 : 11.5) * k;
    const text = name.toUpperCase();
    tryPlace({ x: p[0], y: p[1], text, size, role: "ocean", anchor: "middle", letterSpacing: 0.3 }, centred(p[0], p[1], text, size, 0.3));
  }

  // ── Country names ──
  if (o.countryLabels !== false) {
    const candidates = o.countries
      .filter((c) => !(local && c === o.focus))
      .map((c) => {
        const main = mainParts(c) as unknown as GeoPermissibleObjects;
        const [[x0, y0], [x1, y1]] = path.bounds(main);
        return { c, main, w: x1 - x0, h: y1 - y0 };
      })
      .filter((c) => Number.isFinite(c.w) && c.w > 22 * k && c.h > 8 * k)
      .sort((a, b) => b.w * b.h - a.w * a.h);
    for (const { c, main, w, h } of candidates) {
      const [lon, lat] = geoCentroid(main as Parameters<typeof geoCentroid>[0]);
      let p = project(lon, lat);
      // Crescent-shaped countries: fall back to the middle of the visible bounds.
      if (p && !geoContains(main, projection.invert!(p)!)) p = null;
      if (!p) continue;
      const size = Math.max(6.5 * k, Math.min((local ? 10 : 12) * k, Math.sqrt(w * h) / 9));
      const text = c.properties.name.toUpperCase();
      if (textW(text, size, 0.12) > w * 1.25) continue;
      tryPlace(
        { x: p[0], y: p[1] + size * 0.35, text, size, role: "country", anchor: "middle", letterSpacing: 0.12 },
        centred(p[0], p[1] + size * 0.35, text, size, 0.12),
      );
    }
  }

  // ── Cities ──
  const places = layers?.places ?? [];
  if (places.length && !isWorld) {
    const budget = Math.round((o.quiet ? 6 : 16) * Math.min(1.6, scaleBudget));
    let placedCities = 0;
    const ordered = places.filter(([, , , , rank, kind]) => (isContinent ? kind === 2 && rank <= 3 : rank <= 8));
    for (const [name, lon, lat, , rank, kind] of ordered) {
      if (placedCities >= budget) break;
      const inFocus = o.focus ? geoContains(o.focus as unknown as GeoPermissibleObjects, [lon, lat]) : true;
      // Outside the focus country only national capitals, as context.
      if (!inFocus && !(kind === 2 && rank <= 4)) continue;
      if (inFocus && local && kind === 0 && rank > 7) continue;
      const p = project(lon, lat);
      if (!p || p[0] < inner.x || p[0] > inner.x + inner.w || p[1] < inner.y || p[1] > inner.y + inner.h) continue;
      // The user's own point at (almost) the same spot already names this place.
      if (o.circles.some((c) => Math.hypot(c.cx - p[0], c.cy - p[1]) < c.r + 10 * k)) continue;
      const size = (kind === 2 ? 9 : kind === 1 ? 8 : 7.4) * k * (inFocus ? 1 : 0.9);
      const markerR = (kind === 2 ? 2.6 : 1.9) * k;
      const w = textW(name, size);
      const gap = markerR + 2.5 * k;
      const markerBox: Rect = { x: p[0] - markerR, y: p[1] - markerR, w: 2 * markerR, h: 2 * markerR };
      if (placed.some((b) => hit(b, markerBox))) continue;
      const options: [number, number, MapLabel["anchor"], Rect][] = [
        [p[0] + gap, p[1] + size * 0.35, "start", { x: p[0] + gap, y: p[1] - size * 0.6, w, h: size * 1.15 }],
        [p[0] - gap, p[1] + size * 0.35, "end", { x: p[0] - gap - w, y: p[1] - size * 0.6, w, h: size * 1.15 }],
        [p[0], p[1] - gap, "middle", { x: p[0] - w / 2, y: p[1] - gap - size * 0.95, w, h: size * 1.15 }],
        [p[0], p[1] + gap + size * 0.8, "middle", { x: p[0] - w / 2, y: p[1] + gap - size * 0.1, w, h: size * 1.15 }],
      ];
      for (const [x, y, anchor, box] of options) {
        const label: MapLabel = {
          x,
          y,
          text: name,
          size,
          role: inFocus ? "focus-city" : "city",
          anchor,
          marker: { x: p[0], y: p[1], kind: kind === 2 ? "capital" : kind === 1 ? "provincial" : "town" },
        };
        if (tryPlace(label, box)) {
          placed.push(markerBox);
          placedCities++;
          break;
        }
      }
    }
  }

  // ── Seas, gulfs, bays ──
  for (const [name, lon, lat, rank, kind] of marine) {
    if (kind === "ocean" || rank > maxMarineRank + (local ? 1 : 0) || lat < -60) continue;
    const p = project(lon, lat);
    if (!p) continue;
    const size = (rank <= 2 ? 9 : 8) * k;
    const words = name.split(" ");
    const lines = words.length > 2 ? [words.slice(0, Math.ceil(words.length / 2)).join(" "), words.slice(Math.ceil(words.length / 2)).join(" ")] : [name];
    const longest = lines.reduce((a, b) => (a.length > b.length ? a : b));
    tryPlace({ x: p[0], y: p[1], text: lines.join("\n"), size, role: "sea", anchor: "middle" }, centred(p[0], p[1], longest, size, 0, lines.length));
  }

  // ── Lakes large enough to hold a name ──
  if (layers && !isWorld) {
    for (const lake of layers.lakes.features) {
      const name = (lake.properties as { name?: string | null })?.name;
      if (!name) continue;
      const [[x0, y0], [x1, y1]] = path.bounds(lake as unknown as GeoPermissibleObjects);
      if (!(x1 - x0 > 26 * k) || x1 < frame.x || x0 > frame.x + frame.w || y1 < frame.y || y0 > frame.y + frame.h) continue;
      const [lon, lat] = geoCentroid(lake as Parameters<typeof geoCentroid>[0]);
      const p = project(lon, lat);
      if (!p) continue;
      const text = name.replace(/^Lake /, "L. ");
      const size = 7.6 * k;
      tryPlace({ x: p[0], y: p[1] + size * 0.3, text, size, role: "lake", anchor: "middle" }, centred(p[0], p[1] + size * 0.3, text, size));
    }
  }

  // ── Peaks (country and continent maps) ──
  if (layers && !isWorld) {
    let n = 0;
    const maxPeaks = Math.round((o.quiet ? 2 : 5) * Math.min(1.5, scaleBudget));
    for (const [name, lon, lat, elevation, rank] of layers.peaks) {
      if (n >= maxPeaks) break;
      if (isContinent && rank > 3) continue;
      if (o.focus && local && !geoContains(o.focus as unknown as GeoPermissibleObjects, [lon, lat])) continue;
      const p = project(lon, lat);
      if (!p) continue;
      const size = 7.2 * k;
      const text = `${name} ${elevation.toLocaleString("en-US")} m`;
      const w = textW(text, size);
      const box = { x: p[0] + 4 * k, y: p[1] - size * 0.6, w, h: size * 1.15 };
      if (tryPlace({ x: p[0] + 5 * k, y: p[1] + size * 0.35, text, size, role: "peak", anchor: "start", marker: { x: p[0], y: p[1], kind: "peak" } }, box)) n++;
    }
  }

  // ── Physical regions (deserts, basins, plateaus) on small-scale maps ──
  if (layers && !local) {
    for (const [name, lon, lat, rank, kind] of layers.regions) {
      if (rank > (isWorld ? 2 : 4) || !/desert|plateau|basin|plain|range|mtn|lowland|highland/i.test(kind)) continue;
      const p = project(lon, lat);
      if (!p) continue;
      const size = 7.5 * k;
      const text = name.toUpperCase();
      tryPlace({ x: p[0], y: p[1], text, size, role: "region", anchor: "middle", letterSpacing: 0.35 }, centred(p[0], p[1], text, size, 0.35));
    }
  }

  return labels;
}
