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
  /** Poster framing for the showcase: who it's for, the line, and what was typed. */
  poster: { eyebrow: string; headline: string; em?: string; prompt: string; stat?: [string, string] };
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

/** Broad, believable world pattern for share-of-population data (high in the north, lower in the south). */
function worldShare(features: Feature[], seed: number) {
  const r = rng(seed);
  return features.map((f) => {
    const [x, y] = geoCentroid(f as Parameters<typeof geoCentroid>[0]);
    let lo = 55, hi = 80;
    if (y > 35 && x > -30 && x < 45) [lo, hi] = [84, 99];
    else if (y > 24 && x < -50) [lo, hi] = [88, 97];
    else if (x < -30) [lo, hi] = [62, 88];
    else if (y < 15 && y > -36 && x > -20 && x < 52) [lo, hi] = [15, 50];
    else if (y > 12 && y < 42 && x >= 35 && x < 60) [lo, hi] = [72, 99];
    else if (y > 30 && x > 100) [lo, hi] = [78, 97];
    else if (x > 110 && y < -10) [lo, hi] = [88, 96];
    else if (x >= 60 && x < 100 && y < 30) [lo, hi] = [35, 62];
    return Math.round(lo + r() * (hi - lo));
  });
}

const bare = (over: Partial<MapSpec["furniture"]> = {}) => furniture({ title: false, source: false, scalebar: false, north_arrow: false, ...over });
const nameOf = (f: Feature) => (f.properties as { name: string }).name;

export const SPECIMENS: Specimen[] = [
  {
    id: "world-millionaires",
    title: "Where the millionaires live",
    note: "Night style · cities sized by their millionaire population, glowing on a dark world.",
    poster: { eyebrow: "Finance & wealth", headline: "Where the world's", em: "millionaires live.", prompt: "Millionaires by city, worldwide", stat: ["384,500", "in New York alone"] },
    build: () => ({
      data: (
        [
          ["New York", 40.71, -74.0, 384500], ["Bay Area", 37.77, -122.42, 342400], ["Tokyo", 35.68, 139.69, 292300], ["Singapore", 1.35, 103.82, 242400],
          ["London", 51.51, -0.13, 227000], ["Los Angeles", 34.05, -118.24, 212100], ["Paris", 48.86, 2.35, 160100], ["Sydney", -33.87, 151.21, 147000],
          ["Hong Kong", 22.32, 114.17, 143400], ["Beijing", 39.9, 116.4, 125600], ["Shanghai", 31.23, 121.47, 123400], ["Chicago", 41.88, -87.63, 120500],
          ["Toronto", 43.65, -79.38, 104000], ["Zurich", 47.37, 8.54, 99300], ["Seoul", 37.57, 126.98, 82800], ["Dubai", 25.2, 55.27, 81200],
          ["Melbourne", -37.81, 144.96, 64400], ["Mumbai", 19.08, 72.88, 58800], ["São Paulo", -23.55, -46.63, 56400], ["Geneva", 46.2, 6.14, 42000],
          ["Mexico City", 19.43, -99.13, 31000], ["Miami", 25.76, -80.19, 38000], ["Riyadh", 24.71, 46.68, 21000], ["Johannesburg", -26.2, 28.05, 12000],
        ] as [string, number, number, number][]
      ).map(([name, latitude, longitude, value]) => ({ name, latitude, longitude, value })),
      spec: parseMapSpec({
        title: "Where the World's Millionaires Live",
        subtitle: "Resident millionaires by city · illustrative data",
        mapType: "proportional_symbol",
        style: "night",
        geography: { level: "world", region: "World" },
        data: { nameField: "name", latField: "latitude", lonField: "longitude", valueField: "value", valueLabel: "Millionaires", valueFormat: ",.0f" },
        symbology: { palette: "YlOrBr", paletteKind: "sequential", minRadius: 3, maxRadius: 26 },
        furniture: bare({ graticule: false }),
      }),
    }),
  },
  {
    id: "us-home-prices",
    title: "Home prices by state",
    note: "Editorial style · flat, bold state choropleth. No terrain, no rivers, just the story.",
    poster: { eyebrow: "Real estate", headline: "The price map behind", em: "every market report.", prompt: "Median home value by state, United States" },
    subdivisionsOf: "United States of America",
    build: (_geo, subs) => {
      const feats = subs?.adm1?.features ?? [];
      const vals = smoothValues(feats, 5, 165000, 840000);
      return {
        data: feats.map((f, i) => ({ state: nameOf(f), value: Math.round(vals[i] / 1000) * 1000 })),
        spec: parseMapSpec({
          title: "Median Home Value by State",
          subtitle: "United States · illustrative data",
          mapType: "choropleth",
          style: "editorial",
          geography: { level: "admin1", region: "United States" },
          data: { nameField: "state", valueField: "value", valueLabel: "Median home value", valueFormat: "$,.0f" },
          symbology: { palette: "OrRd", paletteKind: "sequential", classes: 5, classification: "quantile" },
          furniture: bare(),
        }),
      };
    },
  },
  {
    id: "europe-chargers",
    title: "EV chargers across Europe",
    note: "Dots style · a dot-matrix choropleth, every country printed in tiny dots.",
    poster: { eyebrow: "Energy & EV", headline: "Plugged in,", em: "coast to coast.", prompt: "Fast chargers per 100,000 people by country, Europe" },
    build: (geo) => {
      const feats = geo.features.filter((f) => {
        const [x, y] = geoCentroid(f as Parameters<typeof geoCentroid>[0]);
        return x > -25 && x < 40 && y > 35 && y < 71 && !["Russia", "Turkey", "Kazakhstan", "Algeria", "Tunisia", "Morocco", "Libya", "Syria", "Iraq", "Iran", "Israel", "Lebanon", "Jordan", "Palestine", "Cyprus", "N. Cyprus", "Azerbaijan", "Armenia", "Georgia"].includes(nameOf(f));
      });
      const vals = smoothValues(feats, 13, 4, 96);
      return {
        data: feats.map((f, i) => ({ country: nameOf(f), value: Math.round(vals[i]) })),
        spec: parseMapSpec({
          title: "Fast Chargers per 100,000 People",
          subtitle: "Europe · illustrative data",
          mapType: "choropleth",
          style: "dots",
          geography: { level: "continent", region: "Europe" },
          data: { nameField: "country", valueField: "value", valueLabel: "Chargers per 100k" },
          symbology: { palette: "Greens", paletteKind: "sequential", classes: 5, classification: "quantile" },
          furniture: bare(),
        }),
      };
    },
  },
  {
    id: "japan-visitors",
    title: "Japan by prefecture",
    note: "Night style · prefectures glowing brighter where the visitors went.",
    poster: { eyebrow: "Tourism & hospitality", headline: "Where the", em: "visitors went.", prompt: "International visitors by prefecture, Japan", stat: ["4.2M", "nights in Tokyo"] },
    subdivisionsOf: "Japan",
    build: (_geo, subs) => {
      const feats = subs?.adm1?.features ?? [];
      const vals = smoothValues(feats, 21, 120, 4200);
      return {
        data: feats.map((f, i) => ({ prefecture: nameOf(f), visitors: Math.round(vals[i]) * 1000 })),
        spec: parseMapSpec({
          title: "International Visitors by Prefecture",
          subtitle: "Overnight stays · illustrative data",
          mapType: "choropleth",
          style: "night",
          page: { size: "A4", orientation: "portrait" },
          geography: { level: "admin1", region: "Japan" },
          data: { nameField: "prefecture", valueField: "visitors", valueLabel: "Overnight stays", valueFormat: ".2s" },
          symbology: { palette: "OrRd", paletteKind: "sequential", classes: 5, classification: "jenks" },
          furniture: bare(),
        }),
      };
    },
  },
  {
    id: "uk-stores",
    title: "Stores sized by sales",
    note: "Editorial style · proportional circles, honest areas, nothing in the way.",
    poster: { eyebrow: "Retail", headline: "Your store network,", em: "sized by sales.", prompt: "Our stores in the United Kingdom, sized by annual sales" },
    build: () => ({
      data: sites(
        [
          ["London", 51.507, -0.128], ["Birmingham", 52.486, -1.89], ["Manchester", 53.48, -2.242], ["Leeds", 53.8, -1.549], ["Glasgow", 55.864, -4.252],
          ["Edinburgh", 55.953, -3.188], ["Bristol", 51.454, -2.588], ["Liverpool", 53.408, -2.991], ["Newcastle", 54.978, -1.617], ["Cardiff", 51.481, -3.179],
          ["Belfast", 54.597, -5.93], ["Nottingham", 52.954, -1.158], ["Southampton", 50.909, -1.404], ["Norwich", 52.63, 1.297], ["Aberdeen", 57.149, -2.094],
          ["Plymouth", 50.375, -4.143], ["Cambridge", 52.205, 0.122], ["Brighton", 50.822, -0.137],
        ],
        9,
        8,
        140,
      ),
      spec: parseMapSpec({
        title: "Annual Sales by Store",
        subtitle: "United Kingdom · illustrative data",
        mapType: "proportional_symbol",
        style: "editorial",
        geography: { level: "country", region: "United Kingdom" },
        data: { nameField: "name", latField: "latitude", lonField: "longitude", valueField: "value", valueLabel: "Sales (£ m)" },
        symbology: { palette: "Reds", paletteKind: "sequential", minRadius: 3, maxRadius: 24 },
        furniture: bare(),
      }),
    }),
  },
  {
    id: "india-coverage",
    title: "India by state",
    note: "Editorial style · state choropleth with crisp white borders.",
    poster: { eyebrow: "Public health", headline: "Target the states", em: "that need it most.", prompt: "Childhood vaccination coverage by state, India" },
    subdivisionsOf: "India",
    build: (_geo, subs) => {
      const feats = subs?.adm1?.features ?? [];
      const vals = smoothValues(feats, 31, 61, 97);
      return {
        data: feats.map((f, i) => ({ state: nameOf(f), value: vals[i] / 100 })),
        spec: parseMapSpec({
          title: "Childhood Vaccination Coverage by State",
          subtitle: "India · illustrative data",
          mapType: "choropleth",
          style: "editorial",
          page: { size: "A4", orientation: "portrait" },
          geography: { level: "admin1", region: "India" },
          data: { nameField: "state", valueField: "value", valueLabel: "Coverage", valueFormat: ".0%" },
          symbology: { palette: "BuGn", paletteKind: "sequential", classes: 5, classification: "quantile" },
          furniture: bare(),
        }),
      };
    },
  },
  {
    id: "brazil-coffee",
    title: "Brazil by state",
    note: "Dots style · production printed as a dot matrix, poster-ready.",
    poster: { eyebrow: "Agribusiness & trade", headline: "Show buyers", em: "where it's grown.", prompt: "Coffee production by state, Brazil, dotted" },
    subdivisionsOf: "Brazil",
    build: (_geo, subs) => {
      const feats = subs?.adm1?.features ?? [];
      const vals = smoothValues(feats, 41, 0, 24000);
      return {
        data: feats.map((f, i) => ({ state: nameOf(f), value: Math.round(vals[i]) })),
        spec: parseMapSpec({
          title: "Coffee Production by State",
          subtitle: "Brazil · thousand bags · illustrative data",
          mapType: "choropleth",
          style: "dots",
          page: { size: "A4", orientation: "portrait" },
          geography: { level: "admin1", region: "Brazil" },
          data: { nameField: "state", valueField: "value", valueLabel: "Thousand bags", valueFormat: ",.0f" },
          symbology: { palette: "YlOrBr", paletteKind: "sequential", classes: 5, classification: "quantile" },
          furniture: bare(),
        }),
      };
    },
  },
  {
    id: "world-internet",
    title: "The world, editorial",
    note: "Editorial style · world choropleth on Equal Earth: honest areas, no Mercator.",
    poster: { eyebrow: "Global data desks", headline: "The whole world,", em: "honestly projected.", prompt: "Share of people using the internet, every country" },
    build: (geo) => {
      const feats = geo.features.filter((f) => nameOf(f) !== "Antarctica");
      const vals = worldShare(feats, 3);
      return {
        data: feats.map((f, i) => ({ country: nameOf(f), share: vals[i] / 100 })),
        spec: parseMapSpec({
          title: "Share of People Using the Internet",
          subtitle: "Percent of population · illustrative data",
          mapType: "choropleth",
          style: "editorial",
          geography: { level: "world", region: "World" },
          data: { nameField: "country", valueField: "share", valueLabel: "Internet users", valueFormat: ".0%" },
          symbology: { palette: "PuBu", paletteKind: "sequential", classes: 5, classification: "quantile" },
          furniture: bare(),
        }),
      };
    },
  },
  {
    id: "canada-fibre",
    title: "Canada by province",
    note: "Night style · coverage glowing province by province.",
    poster: { eyebrow: "Telecoms", headline: "Coverage your", em: "customers can see.", prompt: "Fibre coverage by province, Canada, dark" },
    subdivisionsOf: "Canada",
    build: (_geo, subs) => {
      const feats = subs?.adm1?.features ?? [];
      const vals = smoothValues(feats, 51, 38, 96);
      return {
        data: feats.map((f, i) => ({ province: nameOf(f), value: vals[i] / 100 })),
        spec: parseMapSpec({
          title: "Fibre Broadband Coverage by Province",
          subtitle: "Canada · illustrative data",
          mapType: "choropleth",
          style: "night",
          geography: { level: "admin1", region: "Canada" },
          data: { nameField: "province", valueField: "value", valueLabel: "Homes passed", valueFormat: ".0%" },
          symbology: { palette: "PuBu", paletteKind: "sequential", classes: 5, classification: "quantile" },
          furniture: bare(),
        }),
      };
    },
  },
  {
    id: "france-wine",
    title: "Wine appellations of France",
    note: "Editorial style · categorical points, each style its own colour.",
    poster: { eyebrow: "Wine & spirits", headline: "Every appellation,", em: "one page.", prompt: "Wine appellations in France by style" },
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
        style: "editorial",
        geography: { level: "country", region: "France" },
        data: { nameField: "name", latField: "latitude", lonField: "longitude", categoryField: "category", valueLabel: "Dominant style" },
        symbology: { palette: "Set2", paletteKind: "qualitative" },
        furniture: bare(),
      }),
    }),
  },
  {
    id: "mexico-states",
    title: "States of Mexico",
    note: "Editorial reference plate · every state tinted and named, nothing else.",
    poster: { eyebrow: "Teachers & students", headline: "The map for", em: "tomorrow's lesson.", prompt: "States of Mexico" },
    subdivisionsOf: "Mexico",
    build: () => ({
      data: [],
      spec: parseMapSpec({
        title: "States of Mexico",
        mapType: "reference",
        style: "editorial",
        geography: { level: "admin1", region: "Mexico" },
        data: {},
        symbology: { palette: "Blues", paletteKind: "sequential" },
        furniture: bare({ legend: false }),
      }),
    }),
  },
  {
    id: "peru-physical",
    title: "Peru, physical",
    note: "Atlas style · for when you do want the mountains: relief, rivers and peaks.",
    poster: { eyebrow: "Publishers & guides", headline: "And when you want", em: "the mountains…", prompt: "Physical map of Peru" },
    subdivisionsOf: "Peru",
    build: () => ({
      data: [],
      spec: parseMapSpec({
        title: "Peru: Physical",
        mapType: "reference",
        style: "atlas",
        page: { size: "A4", orientation: "portrait" },
        geography: { level: "admin1", region: "Peru" },
        data: {},
        symbology: { palette: "YlGn", paletteKind: "sequential" },
        furniture: bare({ legend: false }),
      }),
    }),
  },
];
