import { geoCentroid } from "d3-geo";
import type { Feature, FeatureCollection } from "geojson";
import { parseMapSpec, type MapSpec } from "@/lib/mapspec/schema";
import type { Subdivisions } from "@/lib/cartography/join";
import type { Row } from "@/lib/data/parse";

/**
 * Specimen plates: curated example maps rendered live by the same engine customers
 * use. Values are illustrative (seeded, so every visitor sees the same plate).
 */
export interface Specimen {
  id: string;
  title: string;
  note: string;
  /** Country whose provinces/districts the plate needs loaded. */
  subdivisionsOf?: string;
  build: (geo: FeatureCollection, subs?: Subdivisions) => { spec: MapSpec; data: Row[] };
}

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Spatially smooth illustrative values: neighbouring regions look alike, like real data. */
function smoothValues(features: Feature[], seed: number, lo: number, hi: number) {
  const r = rng(seed);
  const bumps = Array.from({ length: 4 }, () => ({ x: r(), y: r(), s: 0.25 + r() * 0.35, a: 0.5 + r() * 0.5 }));
  const cs = features.map((f) => geoCentroid(f as Parameters<typeof geoCentroid>[0]));
  const [x0, x1] = [Math.min(...cs.map((c) => c[0])), Math.max(...cs.map((c) => c[0]))];
  const [y0, y1] = [Math.min(...cs.map((c) => c[1])), Math.max(...cs.map((c) => c[1]))];
  const raw = cs.map(([lon, lat]) => {
    const x = (lon - x0) / (x1 - x0 || 1);
    const y = (lat - y0) / (y1 - y0 || 1);
    let v = 0;
    for (const b of bumps) v += b.a * Math.exp(-((x - b.x) ** 2 + (y - b.y) ** 2) / (2 * b.s * b.s));
    return v * (0.85 + r() * 0.3);
  });
  // Stretch to the requested range so every class of the legend is used.
  const [mn, mx] = [Math.min(...raw), Math.max(...raw)];
  return raw.map((v) => lo + ((v - mn) / (mx - mn || 1)) * (hi - lo));
}

const sites = (rows: [string, number, number][], seed: number, lo = 20, hi = 900) => {
  const r = rng(seed);
  return rows.map(([name, latitude, longitude]) => ({ name, latitude, longitude, value: Math.round(lo + r() ** 1.6 * (hi - lo)) }));
};

const furniture = (over: Partial<MapSpec["furniture"]> = {}) => ({
  title: true,
  legend: true,
  source: true,
  caption: false,
  scalebar: true,
  north_arrow: true,
  graticule: false,
  labels: true,
  ...over,
});

export const SPECIMENS: Specimen[] = [
  {
    id: "peru-stations",
    title: "Rainfall stations of Peru",
    note: "Atlas style · proportional symbols over hypsometric relief — the Andes do the storytelling.",
    build: () => ({
      data: sites(
        [
          ["Lima", -12.046, -77.043], ["Arequipa", -16.409, -71.537], ["Cusco", -13.532, -71.967], ["Trujillo", -8.111, -79.029],
          ["Chiclayo", -6.771, -79.841], ["Piura", -5.194, -80.632], ["Iquitos", -3.749, -73.253], ["Huancayo", -12.065, -75.204],
          ["Puno", -15.84, -70.022], ["Tacna", -18.013, -70.253], ["Cajamarca", -7.164, -78.51], ["Ayacucho", -13.163, -74.224],
          ["Pucallpa", -8.379, -74.553], ["Puerto Maldonado", -12.593, -69.189], ["Tarapoto", -6.482, -76.365], ["Huaraz", -9.527, -77.528],
        ],
        7,
        120,
        2400,
      ),
      spec: parseMapSpec({
        title: "Annual Rainfall at Weather Stations, Peru",
        subtitle: "Millimetres per year · illustrative data",
        mapType: "proportional_symbol",
        style: "atlas",
        geography: { level: "country", region: "Peru" },
        data: { nameField: "name", latField: "latitude", lonField: "longitude", valueField: "value", valueLabel: "Rainfall (mm)" },
        symbology: { palette: "Blues", paletteKind: "sequential", minRadius: 3, maxRadius: 22 },
        furniture: furniture(),
      }),
    }),
  },
  {
    id: "kenya-counties",
    title: "Kenya by county",
    note: "Atlas style · choropleth of all 47 counties, terrain showing through the data colours.",
    subdivisionsOf: "Kenya",
    build: (_geo, subs) => {
      const feats = subs?.adm1?.features ?? [];
      const vals = smoothValues(feats, 11, 18, 92);
      return {
        data: feats.map((f, i) => ({ county: (f.properties as { name: string }).name, coverage: vals[i] / 100 })),
        spec: parseMapSpec({
          title: "Household Access to Piped Water by County",
          subtitle: "Kenya · share of households · illustrative data",
          mapType: "choropleth",
          style: "atlas",
          geography: { level: "admin1", region: "Kenya" },
          data: { nameField: "county", valueField: "coverage", valueLabel: "Households with access", valueFormat: ".0%" },
          symbology: { palette: "YlGnBu", paletteKind: "sequential", classes: 5, classification: "jenks" },
          furniture: furniture(),
        }),
      };
    },
  },
  {
    id: "east-africa-footprint",
    title: "Where we work — East Africa",
    note: "Classic political style · pastel countries, water-lined coasts, rivers and lakes.",
    build: () => ({
      data: ["Kenya", "Uganda", "Tanzania", "Rwanda", "Ethiopia", "South Sudan", "Burundi"].map((country) => ({ country })),
      spec: parseMapSpec({
        title: "Our Programme Countries",
        subtitle: "East Africa, 2026",
        mapType: "footprint",
        style: "classic",
        geography: { level: "continent", region: "East Africa" },
        data: { nameField: "country" },
        symbology: { palette: "Reds", paletteKind: "sequential" },
        furniture: furniture({ legend: true, scalebar: true, north_arrow: false, graticule: true }),
      }),
    }),
  },
  {
    id: "world-renewables",
    title: "The world, classic",
    note: "Classic style · world choropleth on Equal Earth, oceans named like a school atlas.",
    build: (geo) => {
      const feats = geo.features.filter((f) => (f.properties as { name: string }).name !== "Antarctica");
      const vals = smoothValues(feats, 3, 2, 96);
      return {
        data: feats.map((f, i) => ({ country: (f.properties as { name: string }).name, share: vals[i] / 100 })),
        spec: parseMapSpec({
          title: "Renewable Share of Electricity Generation",
          subtitle: "Percent of total generation · illustrative data",
          mapType: "choropleth",
          style: "classic",
          geography: { level: "world", region: "World" },
          data: { nameField: "country", valueField: "share", valueLabel: "Renewable share", valueFormat: ".0%" },
          symbology: { palette: "YlGn", paletteKind: "sequential", classes: 5, classification: "quantile" },
          furniture: furniture({ scalebar: false, north_arrow: false, graticule: true }),
        }),
      };
    },
  },
  {
    id: "nepal-offices",
    title: "Nepal and the Himalaya",
    note: "Atlas style · locator map with peaks, rivers and towns placed without collisions.",
    build: () => ({
      data: [
        ["Kathmandu office", 27.717, 85.324], ["Pokhara", 28.21, 83.985], ["Biratnagar", 26.455, 87.27], ["Nepalgunj", 28.05, 81.617],
        ["Dhangadhi", 28.683, 80.6], ["Janakpur", 26.729, 85.926], ["Jumla", 29.274, 82.183],
      ].map(([name, latitude, longitude]) => ({ name, latitude, longitude })),
      spec: parseMapSpec({
        title: "Field Offices in Nepal",
        subtitle: "Mountain health programme",
        mapType: "point",
        style: "atlas",
        geography: { level: "country", region: "Nepal" },
        data: { nameField: "name", latField: "latitude", lonField: "longitude", valueLabel: "Field office" },
        symbology: { palette: "Reds", paletteKind: "sequential" },
        furniture: furniture({ legend: true }),
      }),
    }),
  },
  {
    id: "japan-prefectures",
    title: "Japan by prefecture",
    note: "Atlas style · portrait page, prefecture choropleth with relief texture.",
    subdivisionsOf: "Japan",
    build: (_geo, subs) => {
      const feats = subs?.adm1?.features ?? [];
      const vals = smoothValues(feats, 21, 120, 4200);
      return {
        data: feats.map((f, i) => ({ prefecture: (f.properties as { name: string }).name, visitors: Math.round(vals[i]) * 1000 })),
        spec: parseMapSpec({
          title: "International Visitors by Prefecture",
          subtitle: "Overnight stays, 2025 · illustrative data",
          mapType: "choropleth",
          style: "atlas",
          page: { size: "A4", orientation: "portrait" },
          geography: { level: "admin1", region: "Japan" },
          data: { nameField: "prefecture", valueField: "visitors", valueLabel: "Overnight stays", valueFormat: ".2s" },
          symbology: { palette: "OrRd", paletteKind: "sequential", classes: 5, classification: "jenks" },
          furniture: furniture(),
        }),
      };
    },
  },
  {
    id: "france-wine",
    title: "France, classic",
    note: "Classic style · categorical points over a political base with rivers.",
    build: () => ({
      data: [
        ["Bordeaux", 44.838, -0.579, "Red"], ["Saint-Émilion", 44.894, -0.155, "Red"], ["Beaune", 47.025, 4.84, "Red"],
        ["Reims", 49.258, 4.032, "Sparkling"], ["Épernay", 49.04, 3.96, "Sparkling"], ["Colmar", 48.079, 7.358, "White"],
        ["Sancerre", 47.331, 2.838, "White"], ["Chablis", 47.814, 3.798, "White"], ["Châteauneuf-du-Pape", 44.056, 4.832, "Red"],
        ["Tours", 47.394, 0.685, "White"], ["Bandol", 43.136, 5.753, "Rosé"], ["Tavel", 44.013, 4.699, "Rosé"],
      ].map(([name, latitude, longitude, category]) => ({ name, latitude, longitude, category })),
      spec: parseMapSpec({
        title: "Wine Appellations of France",
        subtitle: "Selected appellations by dominant style",
        mapType: "categorical_point",
        style: "classic",
        geography: { level: "country", region: "France" },
        data: { nameField: "name", latField: "latitude", lonField: "longitude", categoryField: "category", valueLabel: "Dominant style" },
        symbology: { palette: "Set2", paletteKind: "qualitative" },
        furniture: furniture(),
      }),
    }),
  },
  {
    id: "usa-minimal",
    title: "United States, minimal",
    note: "Minimal style · state choropleth for reports where the data must be the only colour.",
    subdivisionsOf: "United States of America",
    build: (_geo, subs) => {
      const feats = subs?.adm1?.features ?? [];
      const vals = smoothValues(feats, 5, 8, 31);
      return {
        data: feats.map((f, i) => ({ state: (f.properties as { name: string }).name, rate: vals[i] / 100 })),
        spec: parseMapSpec({
          title: "Adults Holding a Bachelor's Degree",
          subtitle: "Share of population aged 25+ · illustrative data",
          mapType: "choropleth",
          style: "minimal",
          geography: { level: "admin1", region: "United States" },
          data: { nameField: "state", valueField: "rate", valueLabel: "Share of adults", valueFormat: ".0%" },
          symbology: { palette: "PuBu", paletteKind: "sequential", classes: 5, classification: "quantile" },
          furniture: furniture(),
        }),
      };
    },
  },
];
