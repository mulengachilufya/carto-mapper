import { geoPath, geoGraticule10, type GeoPermissibleObjects } from "d3-geo";
import { scaleSqrt } from "d3-scale";
import type { Feature, FeatureCollection } from "geojson";
import type { MapSpec } from "@/lib/mapspec/schema";
import { chooseProjection } from "@/lib/cartography/projection";
import { classify, classIndex, type ClassBreaks } from "@/lib/cartography/classify";
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
  bboxPolygon,
  normalizeName,
  type CountryFeature,
} from "@/lib/cartography/geo";
import type { Row } from "@/lib/data/parse";

// Restrained, paper-and-ink palette — the quiet base a cartographer builds on.
const THEME = {
  paper: "#fdfdfb",
  ocean: "#e8eef2",
  land: "#e9e6dd",
  noData: "#e0ddd4",
  noDataHatch: "#cfccc1",
  graticule: "#9aa6ae",
  unitStroke: "#fbfbf8",
  focusStroke: "#b9b3a5",
  ink: "#23231d",
  muted: "#6d6a61",
  neat: "#3a3a32",
  panel: "#ffffff",
  panelBorder: "#dcd9d0",
  symbolStroke: "#ffffff",
};

interface Props {
  spec: MapSpec;
  data?: Row[];
  geo: FeatureCollection;
  width: number;
  height: number;
  className?: string;
}

type Pt = { x: number; y: number; value: number; category?: string; name?: string };

function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v.replace(/[, ]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const MARGIN = 26;

function buildMap(spec: MapSpec, data: Row[], geo: FeatureCollection, width: number, height: number) {
  const level = spec.geography.level;
  const region = spec.geography.region ?? "";
  const isSymbolMap =
    spec.mapType === "proportional_symbol" ||
    spec.mapType === "graduated_symbol" ||
    spec.mapType === "dot" ||
    spec.mapType === "point" ||
    spec.mapType === "categorical_point";

  const nameIndex = buildNameIndex(geo);
  const focusFeature: CountryFeature | undefined =
    level === "country" || level === "admin1" || level === "admin2"
      ? region
        ? findCountry(geo, region)
        : undefined
      : undefined;

  // Don't draw Antarctica on world maps — it carries no data and dominates an Equal-Earth page.
  const drawn = (geo.features as CountryFeature[]).filter(
    (f) => level !== "world" || normalizeName(f.properties.name) !== "antarctica",
  );

  // Project points either from lat/lon columns or from matched-country centroids.
  const rawPoints = extractPoints(spec, data, nameIndex);

  // Decide what to fit the projection to.
  let fitObject: GeoPermissibleObjects;
  if (level === "world") fitObject = bboxPolygon(-180, -58, 180, 85) as unknown as GeoPermissibleObjects;
  else if (level === "continent") fitObject = continentBBoxPolygon(region) ?? geo;
  else if (focusFeature) fitObject = focusFeature as unknown as GeoPermissibleObjects;
  else if (rawPoints.length) fitObject = (pointsBBoxPolygon(rawPoints) as unknown as GeoPermissibleObjects) ?? geo;
  else if (region) fitObject = findCountry(geo, region) ?? geo;
  else fitObject = geo;

  const projection = chooseProjection(level, fitObject, width, height, MARGIN, spec.geography.projectionHint);
  const path = geoPath(projection);
  const pathOf = (g: GeoPermissibleObjects) => path(g) ?? "";

  const graticulePath = pathOf(geoGraticule10());
  const showSphere = level === "world" || level === "continent";
  const spherePath = showSphere ? pathOf({ type: "Sphere" }) : "";

  // ── Choropleth join ──
  let choropleth: {
    units: { d: string; fill: string; name: string }[];
    breaks: ClassBreaks;
    colors: string[];
    hasNoData: boolean;
  } | null = null;

  if (!isSymbolMap && spec.data.valueField && spec.data.nameField) {
    const valueByName = new Map<string, number>();
    for (const row of data) {
      const v = num(row[spec.data.valueField]);
      const nm = row[spec.data.nameField];
      if (v === null || nm == null) continue;
      const f = matchFeature(String(nm), nameIndex);
      if (f) valueByName.set(normalizeName(f.properties.name), v);
    }
    const vals = [...valueByName.values()];
    const breaks = classify(vals, spec.symbology.classification, spec.symbology.classes);
    const colors = getPaletteColors(spec.symbology.palette, breaks.classes, spec.symbology.reverse);
    let hasNoData = false;
    const units = drawn.map((f) => {
      const key = normalizeName(f.properties.name);
      const v = valueByName.get(key);
      if (v === undefined) hasNoData = true;
      const fill = v === undefined ? THEME.noData : colors[classIndex(v, breaks.breaks)] ?? THEME.noData;
      return { d: pathOf(f as unknown as GeoPermissibleObjects), fill, name: f.properties.name };
    });
    choropleth = { units, breaks, colors, hasNoData };
  }

  // ── Base land (context for symbol maps / fallback) ──
  const baseUnits =
    choropleth === null
      ? drawn.map((f) => ({
          d: pathOf(f as unknown as GeoPermissibleObjects),
          isFocus: focusFeature ? f === focusFeature : false,
        }))
      : [];

  // ── Symbols ──
  let symbols: { cx: number; cy: number; r: number; fill: string }[] = [];
  let symbolLegend: { sizes: { r: number; label: string }[]; categories: { color: string; label: string }[] } | null =
    null;

  if (isSymbolMap && rawPoints.length) {
    const projected = rawPoints
      .map((p) => {
        const xy = projection([p.lon, p.lat]);
        return xy ? { ...p, x: xy[0], y: xy[1] } : null;
      })
      .filter((p): p is Pt & { lon: number; lat: number } => p !== null);

    const values = projected.map((p) => Math.abs(p.value)).filter((v) => Number.isFinite(v));
    const maxV = Math.max(...values, 1);
    const rScale = scaleSqrt().domain([0, maxV]).range([spec.symbology.minRadius, spec.symbology.maxRadius]);

    const categorical = spec.mapType === "categorical_point";
    const cats = categorical
      ? Array.from(new Set(projected.map((p) => p.category ?? "—")))
      : [];
    const catColors = getPaletteColors(
      spec.symbology.paletteKind === "qualitative" ? spec.symbology.palette : "Set2",
      Math.max(3, cats.length),
      false,
    );
    const colorForCat = (c?: string) => catColors[Math.max(0, cats.indexOf(c ?? "—")) % catColors.length];
    const baseFill = getPaletteColors(spec.symbology.palette, 5, spec.symbology.reverse)[3];

    const proportional = spec.mapType === "proportional_symbol" || spec.mapType === "graduated_symbol";
    symbols = projected.map((p) => ({
      cx: p.x,
      cy: p.y,
      r: proportional ? Math.max(1.5, rScale(Math.abs(p.value))) : spec.mapType === "dot" ? 2.4 : 5,
      fill: categorical ? colorForCat(p.category) : baseFill,
    }));

    symbolLegend = {
      sizes: proportional
        ? [maxV, maxV / 2, maxV / 8]
            .map((v) => ({ r: Math.max(1.5, rScale(v)), label: formatNumber(v, spec.data.valueFormat) }))
        : [],
      categories: categorical ? cats.map((c) => ({ color: colorForCat(c), label: c })) : [],
    };
  }

  const scalebar: ScaleBar | null = computeScaleBar(projection, width, height);

  return { choropleth, baseUnits, symbols, symbolLegend, graticulePath, spherePath, showSphere, scalebar };
}

function extractPoints(spec: MapSpec, data: Row[], nameIndex: Map<string, CountryFeature>) {
  const { latField, lonField, valueField, categoryField, nameField } = spec.data;
  const out: { lat: number; lon: number; value: number; category?: string; name?: string }[] = [];

  if (latField && lonField) {
    for (const r of data) {
      const lat = num(r[latField]);
      const lon = num(r[lonField]);
      if (lat === null || lon === null) continue;
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
      const f = matchFeature(String(nm), nameIndex);
      if (!f) continue;
      const [lon, lat] = centroidOf(f as unknown as Feature);
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

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [""];
  for (const w of words) {
    const i = lines.length - 1;
    if (!lines[i]) lines[i] = w;
    else if ((lines[i] + " " + w).length <= maxChars) lines[i] += " " + w;
    else if (lines.length < 2) lines.push(w);
    else {
      lines[i] += "…";
      break;
    }
  }
  return lines;
}

export function CartoMap({ spec, data = [], geo, width, height, className }: Props) {
  const m = buildMap(spec, data, geo, width, height);
  const f = spec.furniture;
  const serif = "var(--font-serif, Georgia, 'Times New Roman', serif)";
  const sans = "var(--font-sans, 'Inter', system-ui, sans-serif)";
  const titleLines = wrapText(spec.title, 38);

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
      {/* Ocean / paper ground */}
      {m.showSphere ? (
        <path d={m.spherePath} fill={THEME.ocean} stroke={THEME.neat} strokeWidth={0.6} />
      ) : (
        <rect x={0} y={0} width={width} height={height} fill={THEME.paper} />
      )}

      {/* Graticule */}
      {f.graticule && (
        <path d={m.graticulePath} fill="none" stroke={THEME.graticule} strokeWidth={0.4} strokeOpacity={0.5} />
      )}

      {/* Base land (symbol maps) */}
      {m.baseUnits.map((u, i) => (
        <path
          key={`b${i}`}
          d={u.d}
          fill={u.isFocus ? "#efece3" : THEME.land}
          stroke={THEME.unitStroke}
          strokeWidth={0.4}
        />
      ))}

      {/* Choropleth units */}
      {m.choropleth?.units.map((u, i) => (
        <path key={`u${i}`} d={u.d} fill={u.fill} stroke={THEME.unitStroke} strokeWidth={0.4}>
          <title>{u.name}</title>
        </path>
      ))}

      {/* Symbols */}
      {m.symbols.map((s, i) => (
        <circle
          key={`s${i}`}
          cx={s.cx}
          cy={s.cy}
          r={s.r}
          fill={s.fill}
          fillOpacity={0.78}
          stroke={THEME.symbolStroke}
          strokeWidth={0.6}
        />
      ))}

      {/* Neatline */}
      <rect
        x={MARGIN / 2}
        y={MARGIN / 2}
        width={width - MARGIN}
        height={height - MARGIN}
        fill="none"
        stroke={THEME.neat}
        strokeWidth={1}
      />

      {/* Title block */}
      {f.title && (
        <g>
          {titleLines.map((line, i) => (
            <text
              key={i}
              x={MARGIN}
              y={MARGIN + 18 + i * 24}
              style={{ fontFamily: serif }}
              fontSize={24}
              fontWeight={600}
              fill={THEME.ink}
            >
              {line}
            </text>
          ))}
          {spec.subtitle && (
            <text
              x={MARGIN}
              y={MARGIN + 18 + titleLines.length * 24 - 6}
              style={{ fontFamily: sans }}
              fontSize={12.5}
              fill={THEME.muted}
            >
              {spec.subtitle}
            </text>
          )}
        </g>
      )}

      {/* North arrow */}
      {f.north_arrow && <NorthArrow x={width - MARGIN - 16} y={MARGIN + 12} />}

      {/* Scale bar */}
      {f.scalebar && m.scalebar && (
        <ScaleBarMark
          x={width - MARGIN - m.scalebar.widthPx - 8}
          y={height - MARGIN - 26}
          bar={m.scalebar}
          sans={sans}
        />
      )}

      {/* Legend */}
      {f.legend && m.choropleth && (
        <ChoroplethLegend
          x={MARGIN}
          y={height - MARGIN - legendHeight(m.choropleth.colors.length, m.choropleth.hasNoData)}
          spec={spec}
          breaks={m.choropleth.breaks}
          colors={m.choropleth.colors}
          hasNoData={m.choropleth.hasNoData}
          serif={serif}
          sans={sans}
        />
      )}
      {f.legend && m.symbolLegend && (m.symbolLegend.sizes.length > 0 || m.symbolLegend.categories.length > 0) && (
        <SymbolLegend x={MARGIN} y={height - MARGIN - 10} spec={spec} legend={m.symbolLegend} serif={serif} sans={sans} />
      )}

      {/* Caption + source */}
      {f.caption && spec.caption && (
        <text x={MARGIN} y={height - MARGIN + 14} style={{ fontFamily: sans }} fontSize={11} fill={THEME.muted}>
          {spec.caption}
        </text>
      )}
      {f.source && (
        <text
          x={width - MARGIN}
          y={height - MARGIN + 14}
          textAnchor="end"
          style={{ fontFamily: sans }}
          fontSize={10}
          fill={THEME.muted}
        >
          {spec.source || "Boundaries: Natural Earth · Made with CartoMapper"}
        </text>
      )}
    </svg>
  );
}

function legendHeight(classes: number, hasNoData = false) {
  return 26 + (classes + (hasNoData ? 1 : 0)) * 18;
}

function NorthArrow({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <polygon points="0,-10 4,6 0,2 -4,6" fill={THEME.ink} />
      <text x={0} y={-13} textAnchor="middle" fontSize={11} fontWeight={700} fill={THEME.ink}>
        N
      </text>
    </g>
  );
}

function ScaleBarMark({ x, y, bar, sans }: { x: number; y: number; bar: ScaleBar; sans: string }) {
  return (
    <g transform={`translate(${x},${y})`} style={{ fontFamily: sans }}>
      <rect x={0} y={0} width={bar.widthPx / 2} height={5} fill={THEME.ink} />
      <rect x={bar.widthPx / 2} y={0} width={bar.widthPx / 2} height={5} fill={THEME.paper} stroke={THEME.ink} strokeWidth={0.8} />
      <rect x={0} y={0} width={bar.widthPx} height={5} fill="none" stroke={THEME.ink} strokeWidth={0.8} />
      <text x={0} y={-4} fontSize={9.5} fill={THEME.ink}>
        0
      </text>
      <text x={bar.widthPx} y={-4} textAnchor="end" fontSize={9.5} fill={THEME.ink}>
        {bar.label}
      </text>
    </g>
  );
}

function ChoroplethLegend({
  x,
  y,
  spec,
  breaks,
  colors,
  hasNoData,
  serif,
  sans,
}: {
  x: number;
  y: number;
  spec: MapSpec;
  breaks: ClassBreaks;
  colors: string[];
  hasNoData: boolean;
  serif: string;
  sans: string;
}) {
  const title = spec.data.valueLabel || "Value";
  const rows = colors.map((c, i) => ({
    color: c,
    label: `${formatNumber(breaks.breaks[i], spec.data.valueFormat)} – ${formatNumber(breaks.breaks[i + 1], spec.data.valueFormat)}`,
  }));
  const w = 168;
  const h = legendHeight(colors.length, hasNoData);
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={-8} y={-18} width={w} height={h} rx={3} fill={THEME.panel} stroke={THEME.panelBorder} strokeWidth={1} opacity={0.96} />
      <text x={0} y={-4} style={{ fontFamily: serif }} fontSize={12.5} fontWeight={600} fill={THEME.ink}>
        {title}
      </text>
      {rows.map((r, i) => (
        <g key={i} transform={`translate(0,${i * 18 + 6})`} style={{ fontFamily: sans }}>
          <rect x={0} y={0} width={16} height={12} fill={r.color} stroke={THEME.panelBorder} strokeWidth={0.5} />
          <text x={22} y={10} fontSize={10.5} fill={THEME.ink}>
            {r.label}
          </text>
        </g>
      ))}
      {hasNoData && (
        <g transform={`translate(0,${rows.length * 18 + 6})`} style={{ fontFamily: sans }}>
          <rect x={0} y={0} width={16} height={12} fill={THEME.noData} stroke={THEME.panelBorder} strokeWidth={0.5} />
          <text x={22} y={10} fontSize={10.5} fill={THEME.muted}>
            No data
          </text>
        </g>
      )}
    </g>
  );
}

function SymbolLegend({
  x,
  y,
  spec,
  legend,
  serif,
  sans,
}: {
  x: number;
  y: number;
  spec: MapSpec;
  legend: { sizes: { r: number; label: string }[]; categories: { color: string; label: string }[] };
  serif: string;
  sans: string;
}) {
  const title = spec.data.valueLabel || (legend.categories.length ? "Category" : "Value");
  const maxR = legend.sizes[0]?.r ?? 10;
  const blockH = 30 + (legend.sizes.length ? maxR * 2 + 16 : 0) + legend.categories.length * 16;
  const w = 168;
  return (
    <g transform={`translate(${x},${y - blockH})`}>
      <rect x={-8} y={-16} width={w} height={blockH} rx={3} fill={THEME.panel} stroke={THEME.panelBorder} strokeWidth={1} opacity={0.96} />
      <text x={0} y={-2} style={{ fontFamily: serif }} fontSize={12.5} fontWeight={600} fill={THEME.ink}>
        {title}
      </text>
      {/* Nested proportional circles */}
      {legend.sizes.length > 0 && (
        <g transform={`translate(${maxR + 4}, ${maxR + 10})`} style={{ fontFamily: sans }}>
          {legend.sizes.map((s, i) => (
            <g key={i}>
              <circle cx={0} cy={maxR - s.r} r={s.r} fill="none" stroke={THEME.muted} strokeWidth={0.9} />
              <line x1={0} y1={maxR - s.r * 2} x2={maxR + 18} y2={maxR - s.r * 2} stroke={THEME.panelBorder} strokeWidth={0.6} />
              <text x={maxR + 22} y={maxR - s.r * 2 + 3} fontSize={9.5} fill={THEME.ink}>
                {s.label}
              </text>
            </g>
          ))}
        </g>
      )}
      {/* Category swatches */}
      {legend.categories.length > 0 && (
        <g transform="translate(0,8)" style={{ fontFamily: sans }}>
          {legend.categories.map((c, i) => (
            <g key={i} transform={`translate(0,${i * 16})`}>
              <circle cx={6} cy={6} r={5} fill={c.color} fillOpacity={0.8} stroke={THEME.symbolStroke} strokeWidth={0.6} />
              <text x={18} y={9} fontSize={10.5} fill={THEME.ink}>
                {c.label}
              </text>
            </g>
          ))}
        </g>
      )}
    </g>
  );
}
