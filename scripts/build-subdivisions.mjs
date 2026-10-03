#!/usr/bin/env node
/**
 * Build per-country subdivision boundaries (ADM1 provinces/states, ADM2 districts)
 * from geoBoundaries (https://www.geoboundaries.org, CC BY 4.0), simplified and
 * quantized into small TopoJSON files the map renderer loads on demand.
 *
 *   npx -y mapshaper@0.7 -v   # mapshaper must be runnable via npx
 *   node scripts/build-subdivisions.mjs [--cache <dir>] [ISO3 ...]
 *
 * Writes public/geodata/subdivisions/{ISO3}-{1|2}.json and index.json, which maps
 * each country name used in countries-50m.json to its ISO3 code and available levels.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "public/geodata/subdivisions");
const args = process.argv.slice(2);
const cacheIdx = args.indexOf("--cache");
const CACHE = cacheIdx >= 0 ? args.splice(cacheIdx, 2)[1] : path.join(os.tmpdir(), "geoboundaries-cache");
const only = new Set(args.map((a) => a.toUpperCase()));

const GB = (iso, lvl) =>
  `https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/releaseData/gbOpen/${iso}/ADM${lvl}/geoBoundaries-${iso}-ADM${lvl}_simplified.geojson`;
const NE_ADMIN0 =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";

// Natural Earth ADM0 codes that differ from the ISO3 codes geoBoundaries uses.
const ISO_OVERRIDE = { KOS: "XKX", SDS: "SSD", SAH: "ESH", PSX: "PSE" };
// Target size per file; simplification tightens until the file fits.
const MAX_BYTES = { 1: 60_000, 2: 160_000 };

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(CACHE, { recursive: true });

async function fetchCached(url, file) {
  const p = path.join(CACHE, file);
  if (fs.existsSync(p)) return fs.statSync(p).size > 0 ? p : null;
  const res = await fetch(url);
  const buf = res.ok ? Buffer.from(await res.arrayBuffer()) : Buffer.alloc(0);
  // Missing files come back as 404, or as a Git LFS pointer on the raw host.
  const ok = res.ok && buf.length > 200 && buf[0] !== 0x76; /* "version https://git-lfs…" */
  fs.writeFileSync(p, ok ? buf : "");
  return ok ? p : null;
}

function simplify(src, dest, level) {
  for (const pct of ["12%", "6%", "3%", "1.5%", "0.8%"]) {
    execFileSync(
      "npx",
      [
        "-y", "mapshaper@0.7", "-i", src, "-clean",
        "-rename-fields", "name=shapeName",
        "-filter-fields", "name",
        "-simplify", "dp", pct, "keep-shapes",
        "-rename-layers", "units",
        "-o", dest, "format=topojson", "quantization=20000", "force",
      ],
      { stdio: "pipe" },
    );
    if (fs.statSync(dest).size <= MAX_BYTES[level]) return;
  }
}

const admin0 = JSON.parse(fs.readFileSync(await fetchCached(NE_ADMIN0, "ne_50m_admin_0.geojson"), "utf8"));
const world = JSON.parse(fs.readFileSync(path.join(ROOT, "public/geodata/countries-50m.json"), "utf8"));
const worldNames = new Set(world.objects.countries.geometries.map((g) => g.properties.name));

const countries = admin0.features
  .map((f) => ({ name: f.properties.NAME, iso: ISO_OVERRIDE[f.properties.ADM0_A3] ?? f.properties.ADM0_A3 }))
  .filter((c) => worldNames.has(c.name) && (!only.size || only.has(c.iso)));

const indexPath = path.join(OUT, "index.json");
const index = only.size && fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, "utf8")) : {};

async function build(c) {
  const levels = [];
  for (const level of [1, 2]) {
    const src = await fetchCached(GB(c.iso, level), `${c.iso}-ADM${level}.geojson`);
    if (!src) continue;
    const dest = path.join(OUT, `${c.iso}-${level}.json`);
    try {
      simplify(src, dest, level);
      levels.push(level);
    } catch (e) {
      console.warn(`  ${c.iso} ADM${level}: ${String(e.message).split("\n")[0]}`);
    }
  }
  if (levels.length) index[c.name] = { iso: c.iso, levels };
  console.log(`${c.iso.padEnd(4)} ${c.name.padEnd(28)} ${levels.length ? `ADM${levels.join(", ADM")}` : "—"}`);
}

// A few downloads at a time keeps this polite to GitHub and reasonably quick.
const queue = [...countries];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (queue.length) await build(queue.shift());
  }),
);

const sorted = Object.fromEntries(Object.entries(index).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(indexPath, JSON.stringify(sorted, null, 0) + "\n");
console.log(`\n${Object.keys(sorted).length} countries indexed → ${path.relative(ROOT, OUT)}`);
