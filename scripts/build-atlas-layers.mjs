#!/usr/bin/env node
/**
 * Build the atlas reference layers — rivers, lakes, cities, sea names, peaks and
 * physical regions — from Natural Earth (public domain) into compact files the map
 * renderer loads on demand.
 *
 *   node scripts/build-atlas-layers.mjs [--cache <dir>]
 *
 * Writes public/geodata/atlas/{rivers,lakes}.json (TopoJSON) and
 * {places,marine,peaks,regions}.json (compact point arrays, documented below).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "public/geodata/atlas");
const args = process.argv.slice(2);
const cacheIdx = args.indexOf("--cache");
const CACHE = cacheIdx >= 0 ? args[cacheIdx + 1] : path.join(os.tmpdir(), "natural-earth-cache");
const NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson";

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(CACHE, { recursive: true });

async function source(name) {
  const p = path.join(CACHE, `${name}.geojson`);
  if (!fs.existsSync(p)) {
    const res = await fetch(`${NE}/${name}.geojson`);
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    fs.writeFileSync(p, Buffer.from(await res.arrayBuffer()));
  }
  return p;
}

const mapshaper = (...a) => execFileSync("npx", ["-y", "mapshaper@0.7", ...a], { stdio: "pipe" });
const round = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d;
const write = (file, data) => {
  fs.writeFileSync(path.join(OUT, file), typeof data === "string" ? data : JSON.stringify(data));
  console.log(`${file.padEnd(14)} ${(fs.statSync(path.join(OUT, file)).size / 1024).toFixed(0)} KB`);
};

// Rivers: centerlines with a scale rank (0 = Nile/Amazon … 12 = local) for weighting.
{
  const src = await source("ne_10m_rivers_lake_centerlines_scale_rank");
  const out = path.join(OUT, "rivers.json");
  mapshaper(
    "-i", src,
    "-filter", "featurecla !== 'Lake Centerline (Intermittent)'",
    "-each", "rank=scalerank, name=name_en || name || null",
    "-filter-fields", "rank,name",
    "-simplify", "dp", "25%",
    "-rename-layers", "rivers",
    "-o", out, "format=topojson", "quantization=50000", "force",
  );
  console.log(`rivers.json    ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
}

// Lakes (and reservoirs) with names for labelling.
{
  const src = await source("ne_10m_lakes");
  const out = path.join(OUT, "lakes.json");
  mapshaper(
    "-i", src,
    "-each", "rank=scalerank, name=name_en || name || null",
    "-filter-fields", "rank,name",
    "-simplify", "dp", "20%", "keep-shapes",
    "-rename-layers", "lakes",
    "-o", out, "format=topojson", "quantization=50000", "force",
  );
  console.log(`lakes.json     ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
}

// Places: [name, lon, lat, population, rank, kind, iso3]
//   rank: Natural Earth scalerank (lower = more important)
//   kind: 2 = national capital, 1 = provincial capital, 0 = other town
{
  const fc = JSON.parse(fs.readFileSync(await source("ne_10m_populated_places_simple"), "utf8"));
  const rows = fc.features
    .map(({ properties: p }) => [
      p.name,
      round(p.longitude),
      round(p.latitude),
      p.pop_max || 0,
      p.scalerank,
      p.adm0cap ? 2 : /Admin-1 capital/.test(p.featurecla) ? 1 : 0,
      p.adm0_a3,
    ])
    .sort((a, b) => a[4] - b[4] || b[3] - a[3]);
  write("places.json", rows);
}

// Seas and oceans: [name, lon, lat, rank, kind] at an interior point of each water body.
{
  const src = await source("ne_10m_geography_marine_polys");
  const tmp = path.join(CACHE, "marine-points.geojson");
  mapshaper("-i", src, "-points", "inner", "-o", tmp, "format=geojson", "force");
  const fc = JSON.parse(fs.readFileSync(tmp, "utf8"));
  write(
    "marine.json",
    fc.features
      .filter((f) => f.properties.name && f.geometry)
      .map(({ properties: p, geometry: g }) => [
        p.name_en || p.name,
        round(g.coordinates[0], 2),
        round(g.coordinates[1], 2),
        p.scalerank,
        p.featurecla,
      ])
      .sort((a, b) => a[3] - b[3]),
  );
}

// Peaks: [name, lon, lat, elevation m, rank]
{
  const fc = JSON.parse(fs.readFileSync(await source("ne_10m_geography_regions_elevation_points"), "utf8"));
  write(
    "peaks.json",
    fc.features
      .filter((f) => f.properties.elevation > 0)
      .map(({ properties: p }) => [p.name_en || p.name, round(p.long_x, 2), round(p.lat_y, 2), p.elevation, p.scalerank])
      .sort((a, b) => a[4] - b[4] || b[3] - a[3]),
  );
}

// Physical regions (deserts, plateaus, basins, ranges…): [name, lon, lat, rank, kind]
{
  const fc = JSON.parse(fs.readFileSync(await source("ne_50m_geography_regions_points"), "utf8"));
  write(
    "regions.json",
    fc.features
      .map(({ properties: p }) => [p.name_en || p.name, round(p.long_x, 2), round(p.lat_y, 2), p.scalerank, p.featurecla])
      .sort((a, b) => a[3] - b[3]),
  );
}
