import { geoPath, geoGraticule10, geoContains, type GeoPermissibleObjects, type GeoProjection } from "d3-geo";
import { scaleSqrt } from "d3-scale";
import type { Feature, FeatureCollection } from "geojson";
import type { MapSpec } from "@/lib/mapspec/schema";
import { chooseProjection } from "@/lib/cartography/projection";
import { classify, classIndex } from "@/lib/cartography/classify";
import { getPaletteColors } from "@/lib/cartography/palettes";
import { computeScaleBar, type ScaleBar } from "@/lib/cartography/scalebar";
import { formatNumber } from "@/lib/cartography/format";
import {
  buildNameIndex,
  matchFeature,
  centroidOf,
  findCountry,
  continentBBoxPolygon,
  pointsBBoxPolygon,
  normalizeName,
  mainParts,
  type CountryFeature,
} from "@/lib/cartography/geo";
import { chooseJoin, type Subdivisions } from "@/lib/cartography/join";
import type { Row } from "@/lib/data/parse";

// Restrained, paper-and-ink palette — the quiet base a cartographer builds on.
const THEME = {
  paper: "#fdfcf8",
  water: "#dbe6ec", // sea on regional maps
  sphere: "#e5edf1", // sea on world maps
  land: "#e6e2d7", // context land (neighbours)
  focusLand: "#fbfaf5", // the country the map is about
  noData: "#dcd8ce",
  graticule: "#aab8c0",
  unitStroke: "#ffffff",
  contextStroke: "#cbc5b6",
  focusStroke: "#77715f",
  ink: "#1f1f1a",
  muted: "#66635a",
  neat: "#3a3a32",
  panel: "#fffffd",
  panelBorder: "#d6d2c6",
  symbolStroke: "#ffffff",
};

interface Props {
  spec: MapSpec;
  data?: Row[];
  geo: FeatureCollection;
  /** Provinces/districts of the focus country (see useSubdivisions). */
  subdivisions?: Subdivisions;
  width: number;
  height: number;
  className?: string;
  forPdf?: boolean;
}

type Rect = { x: number; y: number; w: number; h: number };
type Corner = "tl" | "tr" | "bl" | "br";
type Extent = [[number, number], [number, number]];
type Sym = { cx: number; cy: number; r: number; fill: string; name: string | undefined };

type LegendModel = { title: string[]; w: number; h: number } & (
  | { kind: "classes"; rows: { color: string; label: string; muted?: boolean }[] }
  | { kind: "sizes"; color: string; maxR: number; sizes: { r: number; label: string }[] }
  | { kind: "symbols"; rowH: number; rows: { color: string; r: number; label: string }[] }
);

function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v.replace(/[, ]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Rough text width — good enough to size boxes without a DOM (works server-side and in PDF). */
const textW = (s: string, size: number, bold = false) => s.length * size * (bold ? 0.58 : 0.54);

const isTop = (c: Corner) => c[0] === "t";
const isLeft = (c: Corner) => c[1] === "l";

function cornerRect(frame: Rect, c: Corner, w: number, h: number, pad: number): Rect {
  return {
    x: isLeft(c) ? frame.x + pad : frame.x + frame.w - pad - w,
    y: isTop(c) ? frame.y + pad : frame.y + frame.h - pad - h,
    w,
    h,
  };
}

const intersects = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function wrapText(text: string, maxChars: number, maxLines = 2): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [""];
  for (const w of words) {
    const i = lines.length - 1;
    if (!lines[i]) lines[i] = w;
    else if ((lines[i] + " " + w).length <= maxChars) lines[i] += " " + w;
    else if (lines.length < maxLines) lines.push(w);
    else {
      lines[i] += "…";
      break;
    }
  }
  return lines.filter(Boolean);
}

/** Largest 1·2·5 × 10ⁿ value not above x — for legend reference sizes. */
function niceFloor(x: number): number {
  if (!(x > 0)) return 0;
  const pow = Math.pow(10, Math.floor(Math.log10(x)));
  const f = x / pow;
  return (f >= 5 ? 5 : f >= 2 ? 2 : 1) * pow;
}

function humanize(s: string): string {
  return s
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

const SYMBOL_TYPES = new Set(["proportional_symbol", "graduated_symbol", "dot", "point", "categorical_point"]);

function buildMap(
  spec: MapSpec,
  data: Row[],
  geo: FeatureCollection,
  W: number,
  H: number,
  subdivisions: Subdivisions | undefined,
) {
  // Everything is sized relative to the page so thumbnails, previews and PDFs share one layout.
  const k = Math.max(0.4, Math.min(2, Math.min(W, H) / 600));
  const f = spec.furniture;
  const b = spec.branding;
  const level = spec.geography.level;
  const region = spec.geography.region ?? "";
  const isWorld = level === "world";
  const isSymbolMap = SYMBOL_TYPES.has(spec.mapType);
  const isFootprint = spec.mapType === "footprint";
  const margin = 20 * k;

  // ── Data join ──
  const nameIndex = buildNameIndex(geo);
  const focusFeature: CountryFeature | undefined =
    (level === "country" || level === "admin1" || level === "admin2" || level === "city") && region
      ? findCountry(geo, region)
      : undefined;

  // Antarctica carries no data and dominates a world page.
  const drawn = (geo.features as CountryFeature[]).filter(
    (ft) => !isWorld || normalizeName(ft.properties.name) !== "antarctica",
  );

  const rawPoints = isSymbolMap ? extractPoints(spec, data, nameIndex) : [];

  // Region maps join place names to whichever boundaries they name: countries, or the
  // focus country's provinces/districts (a province table must not render as "No data").
  const isChoropleth = !isSymbolMap && !isFootprint && Boolean(spec.data.valueField && spec.data.nameField);
  const isRegionMap = (isChoropleth || isFootprint) && Boolean(spec.data.nameField);
  const subs = focusFeature ? subdivisions : undefined;
  const join = isRegionMap
    ? chooseJoin(
        data.map((r) => r[spec.data.nameField!]).filter((v) => v != null).map(String),
        geo,
        subs,
        level,
      )
    : null;
  const regionUnits: CountryFeature[] = join && join.level !== "country" ? join.features : [];
  const joinable: CountryFeature[] = join?.level === "country" ? drawn : regionUnits;
  const keyOf = (ft: CountryFeature) => join?.keyOf(ft) ?? "";

  const footprintMatched = new Set<string>();
  const footprintFeatures: CountryFeature[] = [];
  const valueByKey = new Map<string, number>();
  if (join) {
    for (const row of data) {
      const nm = row[spec.data.nameField!];
      if (nm == null) continue;
      const ft = join.match(String(nm));
      if (!ft) continue;
      if (isFootprint && !footprintMatched.has(keyOf(ft))) {
        footprintMatched.add(keyOf(ft));
        footprintFeatures.push(ft);
      }
      const v = isChoropleth ? num(row[spec.data.valueField!]) : null;
      if (v !== null) valueByKey.set(keyOf(ft), v);
    }
  }
  const usesSubdivisions = Boolean(regionUnits.length || subs?.adm1);

  // ── What the projection is fitted to ──
  let fitObject: GeoPermissibleObjects;
  if (isWorld) fitObject = { type: "Sphere" };
  else if (level === "continent" && continentBBoxPolygon(region)) fitObject = continentBBoxPolygon(region)!;
  else if (focusFeature) {
    // Frame the mainland, but never crop away the user's own points.
    const pts = pointsBBoxPolygon(rawPoints, 0.02);
    fitObject = {
      type: "FeatureCollection",
      features: pts ? [mainParts(focusFeature), pts] : [mainParts(focusFeature)],
    } as unknown as GeoPermissibleObjects;
  }
  else if (isFootprint && footprintFeatures.length)
    fitObject = { type: "FeatureCollection", features: footprintFeatures } as unknown as GeoPermissibleObjects;
  else if (rawPoints.length) fitObject = pointsBBoxPolygon(rawPoints) ?? { type: "Sphere" };
  else if (isChoropleth && valueByKey.size)
    fitObject = {
      type: "FeatureCollection",
      features: joinable.filter((ft) => valueByKey.has(keyOf(ft))),
    } as unknown as GeoPermissibleObjects;
  else fitObject = { type: "Sphere" };

  // ── Classification / symbol scale (independent of the projection) ──
  let classes: { breaks: number[]; colors: string[] } | null = null;
  if (isChoropleth) {
    const br = classify([...valueByKey.values()], spec.symbology.classification, spec.symbology.classes);
    classes = {
      breaks: br.breaks,
      colors: getPaletteColors(spec.symbology.palette, br.classes, spec.symbology.reverse).slice(0, br.classes),
    };
  }
  const colorFor = (v: number | undefined) =>
    v === undefined || !classes ? THEME.noData : classes.colors[classIndex(v, classes.breaks)] ?? THEME.noData;
  const hasNoData = isChoropleth && joinable.some((ft) => !valueByKey.has(keyOf(ft)));

  const proportional = spec.mapType === "proportional_symbol" || spec.mapType === "graduated_symbol";
  const categorical = spec.mapType === "categorical_point";
  const maxV = Math.max(1e-9, ...rawPoints.map((p) => Math.abs(p.value)).filter(Number.isFinite));
  const maxR = spec.symbology.maxRadius * k;
  const minR = Math.max(1.2, spec.symbology.minRadius * k);
  // True proportional symbols: area ∝ value (r ∝ √v), floored so tiny values stay visible.
  const rScale = scaleSqrt().domain([0, maxV]).range([0, maxR]);
  const cats = categorical ? Array.from(new Set(rawPoints.map((p) => p.category || "Other"))) : [];
  const catColors = getPaletteColors(
    spec.symbology.paletteKind === "qualitative" ? spec.symbology.palette : "Dark2",
    Math.max(3, cats.length),
    false,
  );
  const colorForCat = (c?: string) => catColors[Math.max(0, cats.indexOf(c || "Other")) % catColors.length];
  const seq = getPaletteColors(spec.symbology.palette, 7, spec.symbology.reverse);
  const symbolFill = spec.symbology.paletteKind === "qualitative" ? seq[0] : seq[5];
  const pointR = spec.mapType === "dot" ? 2.6 * k : 4.2 * k;
  const radiusOf = (v: number) => (proportional ? Math.max(minR, rScale(Math.abs(v))) : pointR);

  // ── Legend content ──
  const legend = f.legend ? buildLegend() : null;

  function buildLegend(): LegendModel | null {
    const pad = 9 * k;
    const titleSize = 10.5 * k;
    const labelSize = 9 * k;
    const titleText = (fallback: string) => wrapText(spec.data.valueLabel || fallback, 30, 2);
    const box = (title: string[], contentW: number, contentH: number) => ({
      w: pad * 2 + Math.max(contentW, ...title.map((t) => textW(t, titleSize, true))),
      h: pad * 2 + title.length * titleSize * 1.2 + 5 * k + contentH,
    });

    if (isChoropleth && classes) {
      const rows = classes.colors.map((color, i) => ({
        color,
        label:
          classes!.colors.length === 1
            ? formatNumber(classes!.breaks[0], spec.data.valueFormat)
            : `${formatNumber(classes!.breaks[i], spec.data.valueFormat)} – ${formatNumber(classes!.breaks[i + 1], spec.data.valueFormat)}`,
      }));
      if (hasNoData) rows.push({ color: THEME.noData, label: "No data", muted: true } as (typeof rows)[number]);
      const title = titleText("Value");
      const labelW = Math.max(...rows.map((r) => textW(r.label, labelSize)));
      return { kind: "classes", title, rows, ...box(title, 14 * k + 7 * k + labelW, rows.length * 15 * k - 3 * k) };
    }

    if (isFootprint) {
      const title = titleText("Legend");
      const label = spec.data.valueLabel ? "Included" : "Where we work";
      const accent = getPaletteColors(spec.symbology.palette, 5, false)[3];
      const rows = [{ color: accent, label }];
      return {
        kind: "classes",
        title: spec.data.valueLabel ? title : [],
        rows,
        ...box(spec.data.valueLabel ? title : [], 21 * k + textW(label, labelSize), 12 * k),
      };
    }

    if (!rawPoints.length) return null;

    if (proportional) {
      // Reference circles at round values, dropped when their labels would collide.
      const vals = [niceFloor(maxV), niceFloor(maxV / 4), niceFloor(maxV / 16)].filter((v, i, a) => v > 0 && a.indexOf(v) === i);
      const sizes: { r: number; label: string }[] = [];
      for (const v of vals) {
        const r = radiusOf(v);
        const prev = sizes[sizes.length - 1];
        if (!prev || 2 * (prev.r - r) >= labelSize * 1.15) sizes.push({ r, label: formatNumber(v, spec.data.valueFormat) });
      }
      const top = sizes[0]?.r ?? maxR;
      const title = titleText("Value");
      const labelW = Math.max(...sizes.map((s) => textW(s.label, labelSize)));
      return { kind: "sizes", title, color: symbolFill, maxR: top, sizes, ...box(title, 2 * top + 10 * k + labelW, 2 * top) };
    }

    const r = Math.max(pointR, 3.5 * k);
    const rowH = Math.max(15 * k, 2 * r + 5 * k);
    if (categorical) {
      const title = wrapText(spec.data.valueLabel || categoryTitle(spec.data.categoryField), 30, 2);
      const rows = cats.map((c) => ({ color: colorForCat(c), r, label: c }));
      const labelW = Math.max(...rows.map((row) => textW(row.label, labelSize)));
      return { kind: "symbols", rowH, title, rows, ...box(title, 2 * r + 7 * k + labelW, rows.length * rowH - 4 * k) };
    }
    const label = spec.mapType === "dot" ? "1 dot = 1 record" : spec.data.valueLabel || "Location";
    const rows = [{ color: symbolFill, r, label }];
    return { kind: "symbols", rowH, title: [], rows, ...box([], 2 * r + 7 * k + textW(label, labelSize), rowH - 4 * k) };
  }

  // ── Header (title block + logo) ──
  const titleSize = 22 * k;
  const logoSize = b.logoDataUrl ? 46 * k : 0;
  const titleMaxW = W - 2 * margin - (logoSize ? logoSize + 14 * k : 0);
  const titleLines = f.title ? wrapText(spec.title, Math.max(12, Math.floor(titleMaxW / (titleSize * 0.47))), 2) : [];
  const header: { text: string; y: number; kind: "title" | "subtitle" | "org" }[] = [];
  let cursor = 0;
  titleLines.forEach((t, i) => {
    cursor += i === 0 ? titleSize * 0.82 : titleSize * 1.12;
    header.push({ text: t, y: cursor, kind: "title" });
  });
  if (f.title && spec.subtitle) {
    cursor += 17 * k;
    header.push({ text: spec.subtitle, y: cursor, kind: "subtitle" });
  }
  if (f.title && b.organisation) {
    cursor += 15 * k;
    header.push({ text: b.organisation.toUpperCase(), y: cursor, kind: "org" });
  }
  const headerH = Math.max(cursor ? cursor + 12 * k : 0, logoSize ? logoSize + 10 * k : 0);

  // ── Footer (caption, notes, source) ──
  const footSize = 8.5 * k;
  const footMaxChars = Math.floor((W - 2 * margin) / (footSize * 0.54));
  const footer: { text: string; muted?: boolean }[] = [];
  if (f.caption && spec.caption) wrapText(spec.caption, footMaxChars, 2).forEach((t) => footer.push({ text: t }));
  if (b.notes) wrapText(b.notes, footMaxChars, 3).forEach((t) => footer.push({ text: t }));
  if (f.source) {
    let source = spec.source || "Boundaries: Natural Earth · Made with CartoMapper";
    if (usesSubdivisions && !/geoboundaries/i.test(source)) source += " · Subdivisions: geoBoundaries (CC BY 4.0)";
    footer.push({ text: source, muted: true });
  }
  const footLine = footSize * 1.35;
  const footerH = footer.length ? 8 * k + footer.length * footLine : 0;

  // ── Map frame + projection ──
  let frame: Rect = { x: margin, y: margin + headerH, w: W - 2 * margin, h: H - 2 * margin - headerH - footerH };
  const insetOf = (fr: Rect) => (isWorld ? 5 * k : Math.max(10 * k, 0.05 * Math.min(fr.w, fr.h)));
  const extentOf = (fr: Rect): Extent => [
    [fr.x + insetOf(fr), fr.y + insetOf(fr)],
    [fr.x + fr.w - insetOf(fr), fr.y + fr.h - insetOf(fr)],
  ];
  const fit = (ext: Extent) => chooseProjection(level, fitObject, ext, spec.geography.projectionHint);

  let projection = fit(extentOf(frame));
  let legendBelow = false;

  // World maps sit on bare paper, so trim the frame to the globe; the legend can then sit below it.
  if (isWorld) {
    const [[, y0], [, y1]] = geoPath(projection).bounds({ type: "Sphere" });
    const tight = y1 - y0 + 2 * insetOf(frame);
    const excess = frame.h - tight;
    // Only worth it on tall pages; on landscape the globe simply sits centred in its frame.
    if (excess > 0.25 * frame.h) {
      legendBelow = Boolean(legend && excess >= legend.h + 12 * k);
      frame = { ...frame, h: tight };
      projection = fit(extentOf(frame));
    }
  }

  const projectSymbols = (proj: GeoProjection): Sym[] =>
    rawPoints
      .map((p): Sym | null => {
        const xy = proj([p.lon, p.lat]);
        if (!xy) return null;
        return {
          cx: xy[0],
          cy: xy[1],
          r: radiusOf(p.value),
          fill: categorical ? colorForCat(p.category) : symbolFill,
          name: p.name,
        };
      })
      .filter((s): s is Sym => s !== null)
      .sort((a, c) => c.r - a.r); // big first, so small symbols stay visible on top

  // ── Legend placement: emptiest corner, else refit the map to make room ──
  const cornerPad = 8 * k;
  let legendRect: Rect | null = null;
  let legendCorner: Corner | null = null;
  if (legend && legendBelow) {
    legendRect = { x: frame.x, y: frame.y + frame.h + 12 * k, w: legend.w, h: legend.h };
  } else if (legend) {
    const weighted: { f: GeoPermissibleObjects; w: number }[] = [];
    const isData = (ft: CountryFeature) =>
      join ? valueByKey.has(keyOf(ft)) || footprintMatched.has(keyOf(ft)) : false;
    for (const ft of [...drawn, ...regionUnits]) {
      const important = isData(ft) || ft === focusFeature;
      weighted.push({ f: ft as unknown as GeoPermissibleObjects, w: important ? 3 : isChoropleth ? 0.8 : 0.4 });
    }
    weighted.sort((a, c) => c.w - a.w);

    const score = (proj: GeoProjection, rect: Rect) => {
      const path = geoPath(proj);
      const syms = projectSymbols(proj);
      const items = weighted.map((it) => ({ ...it, b: path.bounds(it.f) }));
      const nx = 9;
      const ny = 6;
      let total = 0;
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < ny; j++) {
          const x = rect.x + ((i + 0.5) * rect.w) / nx;
          const y = rect.y + ((j + 0.5) * rect.h) / ny;
          let best = syms.some((s) => (x - s.cx) ** 2 + (y - s.cy) ** 2 <= (s.r + 2 * k) ** 2) ? 3 : 0;
          let ll: [number, number] | null | undefined;
          for (const it of items) {
            if (it.w <= best) break;
            const [[x0, y0], [x1, y1]] = it.b;
            if (x < x0 || x > x1 || y < y0 || y > y1) continue;
            if (ll === undefined) ll = invertChecked(proj, x, y);
            if (!ll) break;
            if (geoContains(it.f, ll)) best = it.w;
          }
          total += best;
        }
      }
      return total / (nx * ny);
    };

    const bias: Record<Corner, number> = { bl: 0, br: 0.02, tl: 0.04, tr: 0.05 };
    let best: { c: Corner; s: number } | null = null;
    for (const c of ["bl", "br", "tl", "tr"] as Corner[]) {
      const s = score(projection, cornerRect(frame, c, legend.w, legend.h, cornerPad)) + bias[c];
      if (!best || s < best.s) best = { c, s };
    }
    legendCorner = best!.c;

    // Still covering the data? Shrink the map's extent away from the legend.
    if (best!.s - bias[legendCorner] > 0.12) {
      const gap = cornerPad + 6 * k + (isSymbolMap ? maxR * 0.5 : 0);
      const [[x0, y0], [x1, y1]] = extentOf(frame);
      const side: Extent = isLeft(legendCorner)
        ? [[Math.max(x0, frame.x + cornerPad + legend.w + gap), y0], [x1, y1]]
        : [[x0, y0], [Math.min(x1, frame.x + frame.w - cornerPad - legend.w - gap), y1]];
      const updown: Extent = isTop(legendCorner)
        ? [[x0, Math.max(y0, frame.y + cornerPad + legend.h + gap)], [x1, y1]]
        : [[x0, y0], [x1, Math.min(y1, frame.y + frame.h - cornerPad - legend.h - gap)]];
      const candidates = [side, updown]
        .filter(([[a, c], [d, e]]) => d - a > 40 * k && e - c > 40 * k)
        .map((ext) => fit(ext));
      if (candidates.length) projection = candidates.reduce((p, q) => (q.scale() > p.scale() ? q : p));
    }
    legendRect = cornerRect(frame, legendCorner, legend.w, legend.h, cornerPad);
  }

  // ── Geometry under the final projection ──
  const path = geoPath(projection);
  const pathOf = (g: GeoPermissibleObjects) => path(g) ?? "";

  const accent = getPaletteColors(spec.symbology.palette, 5, false)[3];
  const regionFill = (ft: CountryFeature) =>
    isChoropleth ? colorFor(valueByKey.get(keyOf(ft))) : footprintMatched.has(keyOf(ft)) ? accent : THEME.focusLand;
  const countryLevelJoin = join?.level === "country";

  const units = drawn.map((ft) => {
    let fill = THEME.land;
    let stroke = THEME.contextStroke;
    if (countryLevelJoin) {
      fill = regionFill(ft);
      stroke = THEME.unitStroke;
    } else if (ft === focusFeature) {
      fill = THEME.focusLand;
    } else if (!focusFeature && !isWorld) {
      fill = THEME.focusLand;
    }
    return { d: pathOf(ft as unknown as GeoPermissibleObjects), fill, stroke, name: ft.properties.name };
  });
  // Provinces/districts the data is joined to, drawn over their country.
  const regions = regionUnits.map((ft) => ({
    d: pathOf(ft as unknown as GeoPermissibleObjects),
    fill: regionFill(ft),
    name: ft.properties.name,
  }));
  // Province lines for context: on locator/symbol maps, and over district shading.
  const provinceLines =
    subs?.adm1 && join?.level !== "adm1" ? pathOf(subs.adm1 as unknown as GeoPermissibleObjects) : "";
  const provinceLineStyle = join?.level === "adm2" && isChoropleth ? "over-districts" : "context";
  const focusPath =
    focusFeature && !countryLevelJoin ? pathOf(focusFeature as unknown as GeoPermissibleObjects) : "";

  const symbols = projectSymbols(projection);
  const graticulePath = f.graticule ? pathOf(geoGraticule10()) : "";
  const spherePath = isWorld ? pathOf({ type: "Sphere" }) : "";

  // ── North arrow + scale bar go in corners the legend doesn't use ──
  const northCorner: Corner = legendCorner === "tr" ? "tl" : "tr";
  const scaleCorner: Corner = legendCorner === "br" ? "bl" : "br";
  const northRect = f.north_arrow ? cornerRect(frame, northCorner, 18 * k, 30 * k, 10 * k) : null;
  const scalebar: ScaleBar | null =
    f.scalebar && !isWorld
      ? computeScaleBar(projection, [frame.x + frame.w / 2, frame.y + frame.h / 2], 100 * k)
      : null;
  const scaleRect = scalebar
    ? cornerRect(frame, scaleCorner, scalebar.widthPx + 12 * k + textW(scalebar.label, 8 * k) / 2, 28 * k, 6 * k)
    : null;

  // ── Point labels (locator maps) ──
  const labels =
    spec.mapType === "point" && symbols.length <= 40
      ? placeLabels(symbols, 8.5 * k, frame, [legendRect, northRect, scaleRect].filter((r): r is Rect => r !== null), k)
      : [];

  const footerTop = legendBelow && legendRect ? legendRect.y + legendRect.h : frame.y + frame.h;

  return {
    k,
    margin,
    header: header.map((h) => ({ ...h, y: h.y + margin })),
    logo: logoSize ? { x: W - margin - logoSize, y: margin, size: logoSize } : null,
    footer: footer.map((l, i) => ({ ...l, y: footerTop + 8 * k + (i + 0.8) * footLine })),
    footSize,
    frame,
    isWorld,
    units,
    regions,
    provinceLines,
    provinceLineStyle,
    focusPath,
    symbols,
    labels,
    graticulePath,
    spherePath,
    legend,
    legendRect,
    northRect,
    scalebar,
    scaleRect,
  };
}

function categoryTitle(field?: string): string {
  if (!field || /^(category|categories|type|class|kind)$/i.test(field.trim())) return "Type";
  return humanize(field);
}

function invertChecked(proj: GeoProjection, x: number, y: number): [number, number] | null {
  const ll = proj.invert?.([x, y]);
  if (!ll || !Number.isFinite(ll[0]) || !Number.isFinite(ll[1])) return null;
  const back = proj(ll);
  if (!back || Math.hypot(back[0] - x, back[1] - y) > 1) return null;
  return ll as [number, number];
}

function placeLabels(symbols: Sym[], size: number, frame: Rect, obstacles: Rect[], k: number) {
  const placed: Rect[] = [];
  const dots: Rect[] = symbols.map((s) => ({ x: s.cx - s.r, y: s.cy - s.r, w: 2 * s.r, h: 2 * s.r }));
  const out: { x: number; y: number; anchor: "start" | "middle" | "end"; text: string }[] = [];
  for (const s of symbols) {
    if (!s.name) continue;
    const w = textW(s.name, size);
    const gap = s.r + 3 * k;
    const options = [
      { x: s.cx + gap, y: s.cy + size * 0.35, anchor: "start" as const, box: { x: s.cx + gap, y: s.cy - size * 0.6, w, h: size * 1.2 } },
      { x: s.cx - gap, y: s.cy + size * 0.35, anchor: "end" as const, box: { x: s.cx - gap - w, y: s.cy - size * 0.6, w, h: size * 1.2 } },
      { x: s.cx, y: s.cy - gap, anchor: "middle" as const, box: { x: s.cx - w / 2, y: s.cy - gap - size, w, h: size * 1.2 } },
      { x: s.cx, y: s.cy + gap + size * 0.8, anchor: "middle" as const, box: { x: s.cx - w / 2, y: s.cy + gap - size * 0.1, w, h: size * 1.2 } },
    ];
    const ok = options.find(
      (o) =>
        o.box.x > frame.x + 4 * k &&
        o.box.x + o.box.w < frame.x + frame.w - 4 * k &&
        o.box.y > frame.y + 4 * k &&
        o.box.y + o.box.h < frame.y + frame.h - 4 * k &&
        !placed.some((p) => intersects(p, o.box)) &&
        !obstacles.some((p) => intersects(p, o.box)) &&
        !dots.some((d) => intersects(d, o.box)),
    );
    if (ok) {
      placed.push(ok.box);
      out.push({ x: ok.x, y: ok.y, anchor: ok.anchor, text: s.name });
    }
  }
  return out;
}

function extractPoints(spec: MapSpec, data: Row[], nameIndex: Map<string, CountryFeature>) {
  const { latField, lonField, valueField, categoryField, nameField } = spec.data;
  const out: { lat: number; lon: number; value: number; category?: string; name?: string }[] = [];

  if (latField && lonField) {
    for (const r of data) {
      const lat = num(r[latField]);
      const lon = num(r[lonField]);
      if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
      out.push({
        lat,
        lon,
        value: valueField ? num(r[valueField]) ?? 1 : 1,
        category: categoryField ? String(r[categoryField] ?? "") : undefined,
        name: nameField ? String(r[nameField] ?? "") : undefined,
      });
    }
    return out;
  }

  // No coordinates → place at matched-country centroids.
  if (nameField) {
    for (const r of data) {
      const nm = r[nameField];
      if (nm == null) continue;
      const ft = matchFeature(String(nm), nameIndex);
      if (!ft) continue;
      const [lon, lat] = centroidOf(ft as unknown as Feature);
      out.push({
        lat,
        lon,
        value: valueField ? num(r[valueField]) ?? 1 : 1,
        category: categoryField ? String(r[categoryField] ?? "") : undefined,
        name: String(nm),
      });
    }
  }
  return out;
}

export function CartoMap({ spec, data = [], geo, subdivisions, width, height, className, forPdf }: Props) {
  const m = buildMap(spec, data, geo, width, height, subdivisions);
  const { k, frame } = m;
  // jsPDF embeds standard PDF fonts; map our serif/sans to Times/Helvetica for export.
  const serif = forPdf ? "times" : "var(--font-serif, Georgia, 'Times New Roman', serif)";
  const sans = forPdf ? "helvetica" : "var(--font-sans, 'Inter', system-ui, sans-serif)";
  const clipId = `cm-clip-${[frame.x, frame.y, frame.w, frame.h].map((v) => Math.round(v)).join("-")}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      data-cartomap-ready="true"
      className={className}
      style={{ fontFamily: sans, display: "block", background: THEME.paper }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} />
        </clipPath>
      </defs>
      <rect x={0} y={0} width={width} height={height} fill={THEME.paper} />

      {/* ── Map body, clipped to the frame ── */}
      <g clipPath={`url(#${clipId})`}>
        <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} fill={m.isWorld ? THEME.paper : THEME.water} />
        {m.isWorld && <path d={m.spherePath} fill={THEME.sphere} />}
        {m.graticulePath && (
          <path d={m.graticulePath} fill="none" stroke={THEME.graticule} strokeWidth={0.35 * k} strokeOpacity={0.6} />
        )}
        {m.units.map((u, i) => (
          <path key={`u${i}`} d={u.d} fill={u.fill} stroke={u.stroke} strokeWidth={0.45 * k} strokeLinejoin="round">
            <title>{u.name}</title>
          </path>
        ))}
        {m.regions.map((u, i) => (
          <path key={`r${i}`} d={u.d} fill={u.fill} stroke={THEME.unitStroke} strokeWidth={0.4 * k} strokeLinejoin="round">
            <title>{u.name}</title>
          </path>
        ))}
        {m.provinceLines && (
          <path
            d={m.provinceLines}
            fill="none"
            stroke={m.provinceLineStyle === "over-districts" ? THEME.unitStroke : THEME.contextStroke}
            strokeWidth={(m.provinceLineStyle === "over-districts" ? 1.3 : 0.6) * k}
            strokeLinejoin="round"
          />
        )}
        {m.focusPath && (
          <path d={m.focusPath} fill="none" stroke={THEME.focusStroke} strokeWidth={1.1 * k} strokeLinejoin="round" />
        )}
        {m.isWorld && <path d={m.spherePath} fill="none" stroke={THEME.muted} strokeWidth={0.6 * k} />}
        {m.symbols.map((s, i) => (
          <circle
            key={`s${i}`}
            cx={s.cx}
            cy={s.cy}
            r={s.r}
            fill={s.fill}
            fillOpacity={s.r > 6 * k ? 0.72 : 0.92}
            stroke={THEME.symbolStroke}
            strokeWidth={0.7 * k}
          >
            {s.name && <title>{s.name}</title>}
          </circle>
        ))}
        {m.labels.map((l, i) => (
          <g key={`l${i}`} fontSize={8.5 * k} style={{ fontFamily: sans }}>
            <text x={l.x} y={l.y} textAnchor={l.anchor} fill="none" stroke={THEME.paper} strokeWidth={2.4 * k} strokeLinejoin="round">
              {l.text}
            </text>
            <text x={l.x} y={l.y} textAnchor={l.anchor} fill={THEME.ink}>
              {l.text}
            </text>
          </g>
        ))}
      </g>

      {/* Neatline */}
      <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} fill="none" stroke={THEME.neat} strokeWidth={0.9 * k} />

      {/* ── Title block ── */}
      {m.header.map((h, i) => (
        <text
          key={`h${i}`}
          x={m.margin}
          y={h.y}
          style={{ fontFamily: h.kind === "title" ? serif : sans, letterSpacing: h.kind === "org" ? "0.08em" : undefined }}
          fontSize={(h.kind === "title" ? 22 : h.kind === "subtitle" ? 11.5 : 9) * k}
          fontWeight={h.kind === "subtitle" ? 400 : 700}
          fill={h.kind === "title" ? THEME.ink : THEME.muted}
        >
          {h.text}
        </text>
      ))}
      {m.logo && spec.branding.logoDataUrl && (
        <image
          href={spec.branding.logoDataUrl}
          x={m.logo.x}
          y={m.logo.y}
          width={m.logo.size}
          height={m.logo.size}
          preserveAspectRatio="xMaxYMin meet"
        />
      )}

      {m.northRect && <NorthArrow rect={m.northRect} k={k} />}
      {m.scalebar && m.scaleRect && <ScaleBarMark rect={m.scaleRect} bar={m.scalebar} k={k} sans={sans} />}
      {m.legend && m.legendRect && (
        <Legend model={m.legend} rect={m.legendRect} k={k} serif={serif} sans={sans} boxed={!m.isWorld || m.legendRect.y < frame.y + frame.h} />
      )}

      {/* ── Footer ── */}
      {m.footer.map((l, i) => (
        <text key={`f${i}`} x={m.margin} y={l.y} style={{ fontFamily: sans }} fontSize={m.footSize} fill={l.muted ? THEME.muted : THEME.ink}>
          {l.text}
        </text>
      ))}
    </svg>
  );
}

function NorthArrow({ rect, k }: { rect: Rect; k: number }) {
  const cx = rect.x + rect.w / 2;
  const top = rect.y + 11 * k;
  return (
    <g>
      <polygon
        points={`${cx},${top} ${cx + 5 * k},${top + 16 * k} ${cx},${top + 12 * k}`}
        fill={THEME.ink}
        stroke={THEME.ink}
        strokeWidth={0.6 * k}
        strokeLinejoin="round"
      />
      <polygon
        points={`${cx},${top} ${cx - 5 * k},${top + 16 * k} ${cx},${top + 12 * k}`}
        fill={THEME.paper}
        stroke={THEME.ink}
        strokeWidth={0.6 * k}
        strokeLinejoin="round"
      />
      <text x={cx} y={rect.y + 8 * k} textAnchor="middle" fontSize={9.5 * k} fontWeight={700} fill={THEME.ink}>
        N
      </text>
    </g>
  );
}

function ScaleBarMark({ rect, bar, k, sans }: { rect: Rect; bar: ScaleBar; k: number; sans: string }) {
  const x = rect.x + 8 * k;
  const y = rect.y + 15 * k;
  const h = 4 * k;
  const q = bar.widthPx / 4;
  return (
    <g style={{ fontFamily: sans }}>
      <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx={2 * k} fill={THEME.panel} fillOpacity={0.85} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={x + i * q} y={y} width={q} height={h} fill={i % 2 ? THEME.panel : THEME.ink} />
      ))}
      <rect x={x} y={y} width={bar.widthPx} height={h} fill="none" stroke={THEME.ink} strokeWidth={0.7 * k} />
      <text x={x} y={y - 3.5 * k} textAnchor="middle" fontSize={8 * k} fill={THEME.ink}>
        0
      </text>
      <text x={x + bar.widthPx} y={y - 3.5 * k} textAnchor="middle" fontSize={8 * k} fill={THEME.ink}>
        {bar.label}
      </text>
    </g>
  );
}

function Legend({
  model,
  rect,
  k,
  serif,
  sans,
  boxed,
}: {
  model: LegendModel;
  rect: Rect;
  k: number;
  serif: string;
  sans: string;
  boxed: boolean;
}) {
  const pad = 9 * k;
  const titleSize = 10.5 * k;
  const labelSize = 9 * k;
  const top = pad + model.title.length * titleSize * 1.2 + (model.title.length ? 5 * k : 0);
  return (
    <g transform={`translate(${rect.x},${rect.y})`}>
      {boxed && (
        <rect width={rect.w} height={rect.h} rx={2.5 * k} fill={THEME.panel} fillOpacity={0.94} stroke={THEME.panelBorder} strokeWidth={0.8 * k} />
      )}
      {model.title.map((t, i) => (
        <text
          key={i}
          x={pad}
          y={pad + titleSize * (0.85 + i * 1.2)}
          style={{ fontFamily: serif }}
          fontSize={titleSize}
          fontWeight={700}
          fill={THEME.ink}
        >
          {t}
        </text>
      ))}
      <g style={{ fontFamily: sans }} fontSize={labelSize}>
        {model.kind === "classes" &&
          model.rows.map((r, i) => (
            <g key={i} transform={`translate(${pad},${top + i * 15 * k})`}>
              <rect width={14 * k} height={10 * k} fill={r.color} stroke={THEME.panelBorder} strokeWidth={0.5 * k} />
              <text x={21 * k} y={8.5 * k} fill={r.muted ? THEME.muted : THEME.ink}>
                {r.label}
              </text>
            </g>
          ))}
        {model.kind === "sizes" && (
          <g transform={`translate(${pad + model.maxR},${top})`}>
            {model.sizes.map((s, i) => {
              const cy = 2 * model.maxR - s.r;
              const ty = cy - s.r;
              return (
                <g key={i}>
                  <circle cy={cy} r={s.r} fill={model.color} fillOpacity={0.18} stroke={THEME.muted} strokeWidth={0.8 * k} />
                  <line x1={0} y1={ty} x2={model.maxR + 6 * k} y2={ty} stroke={THEME.muted} strokeWidth={0.5 * k} strokeDasharray={`${1.5 * k} ${1.5 * k}`} />
                  <text x={model.maxR + 9 * k} y={ty + labelSize * 0.35} fill={THEME.ink}>
                    {s.label}
                  </text>
                </g>
              );
            })}
          </g>
        )}
        {model.kind === "symbols" &&
          model.rows.map((r, i) => (
            <g key={i} transform={`translate(${pad},${top + i * model.rowH})`}>
              <circle cx={r.r} cy={model.rowH / 2 - 2 * k} r={r.r} fill={r.color} stroke={THEME.symbolStroke} strokeWidth={0.7 * k} />
              <text x={2 * r.r + 7 * k} y={model.rowH / 2 - 2 * k + labelSize * 0.35} fill={THEME.ink}>
                {r.label}
              </text>
            </g>
          ))}
      </g>
    </g>
  );
}
