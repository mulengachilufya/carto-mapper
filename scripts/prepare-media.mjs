// scripts/prepare-media.mjs
//
// One-time setup: turns your downloaded "Cartomapper media" Drive folder into
// the exact files the new homepage expects, resized and compressed for web.
//
// Usage:
//   1. In Drive, select all files in "Cartomapper media" → Download (you'll get a .zip).
//   2. Unzip it somewhere, e.g. ~/Downloads/Cartomapper media/
//   3. npm i -D sharp   (already added to package.json — just run npm install)
//   4. node scripts/prepare-media.mjs "/absolute/path/to/Cartomapper media"
//
// It reads each file below from your source folder, resizes it for its role
// (hero / section backdrop / archive plate), and writes it into public/media/
// under the filename the components already reference. If a source filename
// doesn't match what's in your folder (Drive sometimes appends " (1)" etc.),
// the script tells you exactly which one it couldn't find — just rename that
// one file to match, or edit the MANIFEST below.

import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const srcDir = process.argv[2];
if (!srcDir) {
  console.error("Usage: node scripts/prepare-media.mjs \"/path/to/Cartomapper media\"");
  process.exit(1);
}

const outDir = path.join(process.cwd(), "public", "media");
mkdirSync(outDir, { recursive: true });

// role -> { width, quality } — hero/backdrops are big and full-bleed,
// plates are small so heavy source files (some are 10MB+) shrink a lot.
const SIZES = {
  hero: { width: 2400, quality: 78 },
  backdrop: { width: 2000, quality: 76 },
  plate: { width: 1000, quality: 80 },
  mono: { width: 1600, quality: 82 }, // the black/white world map, kept as png
};

// [source filename in your Drive folder, output filename, role]
const MANIFEST = [
  ["planet-earth-orbit-outer-space-cosmos-3840x2160-8769.jpg", "hero-earth.jpg", "hero"],
  ["planet-earth-dark-3840x2160-26342.jpg", "earth-dark.jpg", "backdrop"],
  ["pexels-ian-panelo-9494918.jpg", "atlas-gold.jpg", "backdrop"],
  ["world-map-geographic-3840x2160-16653.jpg", "world-geo.jpg", "backdrop"],
  ["pexels-syd-trgt-335495720-27645837.jpg", "globe-museum.jpg", "plate"],
  ["pexels-aliaksei-lepik-557018408-17955385.jpg", "atlas-compass.jpg", "plate"],
  ["world-map-colorful-5k-3840x2160-16652.jpg", "world-colorful.jpg", "plate"],
  ["istockphoto-1389942228-612x612.jpg", "topo-brazil.jpg", "plate"],
  ["pexels-vladimirsrajber-37721308.jpg", "figure-05.jpg", "plate"],
  ["pexels-zehra-guven-432246826-19364447.jpg", "figure-06.jpg", "plate"],
  ["pexels-hujason-32647848.jpg", "figure-07.jpg", "plate"],
  ["pexels-alparslan-uzun-606841680-19234024.jpg", "figure-08.jpg", "plate"],
  ["pexels-yelenaodintsova-10556716.jpg", "figure-09.jpg", "plate"], // spare — swap in if any figure above doesn't fit
  ["world-map-black-and-3840x2160-16671.png", "world-mono.png", "mono"],
];

let ok = 0;
let missing = [];

for (const [srcName, outName, role] of MANIFEST) {
  const srcPath = path.join(srcDir, srcName);
  if (!existsSync(srcPath)) {
    missing.push(srcName);
    continue;
  }
  const { width, quality } = SIZES[role];
  const outPath = path.join(outDir, outName);
  const pipeline = sharp(srcPath).resize({ width, withoutEnlargement: true });

  if (outName.endsWith(".png")) {
    await pipeline.png({ quality, compressionLevel: 9 }).toFile(outPath);
  } else {
    await pipeline.jpeg({ quality, mozjpeg: true }).toFile(outPath);
  }
  console.log(`✓ ${outName}`);
  ok++;
}

console.log(`\n${ok}/${MANIFEST.length} images written to public/media/`);
if (missing.length) {
  console.log("\nCouldn't find these in your source folder (check the exact filename):");
  for (const m of missing) console.log(`  - ${m}`);
}
