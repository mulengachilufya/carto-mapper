import type { GeoProjection } from "d3-geo";

/**
 * Terrain for atlas-style maps, rendered in the browser.
 *
 * Elevation comes from the public AWS Terrain Tiles (Mapzen "terrarium" encoding:
 * SRTM, GMTED, ETOPO1 and more; land and sea floor). Tiles are fetched at a zoom
 * that matches the map's scale, sampled through the map's own projection, and turned
 * into either a full hypsometric + hillshade image (the physical atlas look) or a
 * transparent hillshade to lay over data colours.
 */

export type ReliefMode = "atlas" | "shade";

export interface ReliefRequest {
  projection: GeoProjection;
  /** The map frame in SVG user units. */
  frame: { x: number; y: number; w: number; h: number };
  /** Output pixels per SVG unit (2 = crisp on retina and in print). */
  pixelRatio: number;
  /** Which images to produce from one elevation pass. */
  modes: ReliefMode[];
  /** Colour for pixels outside the projection (atlas mode is opaque). */
  paper?: [number, number, number];
  /** Relief to emphasise (1 = neutral); world maps need far more than city maps. */
  exaggeration?: number;
}

export const TERRAIN_ATTRIBUTION = "Terrain: Mapzen Terrain Tiles (SRTM, GMTED, ETOPO1)";

const TILE = 256;
const TILE_URL = (z: number, x: number, y: number) =>
  `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
const MAX_TILES = 40;

// ── Colour ramps (elevation in metres → RGB) ──
// Land follows the classic atlas hypsometric scheme: lowland greens, upland yellows
// and ochres, mountain browns, snow. Sea deepens from coastal cyan to ocean blue.
type Stop = [number, [number, number, number]];
const LAND: Stop[] = [
  [0, [120, 170, 110]],
  [150, [150, 192, 124]],
  [400, [196, 213, 146]],
  [700, [232, 223, 160]],
  [1100, [226, 196, 132]],
  [1700, [205, 160, 108]],
  [2500, [176, 126, 92]],
  [3500, [150, 118, 104]],
  [4500, [196, 188, 184]],
  [5500, [250, 250, 250]],
];
const SEA: Stop[] = [
  [0, [188, 222, 238]],
  [-120, [166, 208, 232]],
  [-500, [136, 188, 222]],
  [-2000, [104, 160, 205]],
  [-4000, [80, 136, 188]],
  [-7000, [60, 112, 168]],
];

function ramp(stops: Stop[], e: number): [number, number, number] {
  const asc = stops[1][0] > stops[0][0];
  for (let i = 1; i < stops.length; i++) {
    const [e1, c1] = stops[i];
    if (asc ? e <= e1 : e >= e1) {
      const [e0, c0] = stops[i - 1];
      const t = (e - e0) / (e1 - e0 || 1);
      return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t];
    }
  }
  return stops[stops.length - 1][1];
}

// ── Tiles ──
const tileCache = new Map<string, Promise<Float32Array | null>>();

function loadTile(z: number, x: number, y: number): Promise<Float32Array | null> {
  const n = 1 << z;
  const key = `${z}/${((x % n) + n) % n}/${y}`;
  if (!tileCache.has(key)) {
    tileCache.set(
      key,
      fetchTile(key).then((t) => t ?? new Promise<Float32Array | null>((r) => setTimeout(() => fetchTile(key).then(r), 400))),
    );
  }
  return tileCache.get(key)!;
}

function fetchTile(key: string): Promise<Float32Array | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = c.height = TILE;
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      const px = ctx.getImageData(0, 0, TILE, TILE).data;
      const out = new Float32Array(TILE * TILE);
      for (let i = 0; i < out.length; i++) out[i] = px[i * 4] * 256 + px[i * 4 + 1] + px[i * 4 + 2] / 256 - 32768;
      resolve(out);
    };
    img.onerror = () => resolve(null);
    img.src = TILE_URL(...(key.split("/").map(Number) as [number, number, number]));
  });
}

const lonToX = (lon: number, z: number) => ((lon + 180) / 360) * (1 << z) * TILE;
const latToY = (lat: number, z: number) => {
  const s = Math.sin((Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * (1 << z) * TILE;
};

export type ReliefImages = Partial<Record<ReliefMode, string>>;

/** Render terrain for a map frame. Resolves image data URLs, or null if nothing loaded. */
export async function renderRelief(req: ReliefRequest): Promise<ReliefImages | null> {
  const { projection, frame, pixelRatio, modes } = req;
  const ow = Math.max(1, Math.round(frame.w * pixelRatio));
  const oh = Math.max(1, Math.round(frame.h * pixelRatio));

  // 1. Where every output pixel lands on the globe (NaN outside the projection).
  const lon = new Float32Array(ow * oh).fill(NaN);
  const lat = new Float32Array(ow * oh).fill(NaN);
  let w = Infinity, e = -Infinity, s = Infinity, nth = -Infinity;
  for (let j = 0; j < oh; j++) {
    for (let i = 0; i < ow; i++) {
      const sx = frame.x + (i + 0.5) / pixelRatio;
      const sy = frame.y + (j + 0.5) / pixelRatio;
      const ll = projection.invert?.([sx, sy]);
      if (!ll || !Number.isFinite(ll[0]) || !Number.isFinite(ll[1])) continue;
      // Reject points the projection folds back from outside its domain (world edges).
      if ((i & 7) === 0 || (j & 7) === 0) {
        const back = projection(ll);
        if (!back || Math.abs(back[0] - sx) > 1 || Math.abs(back[1] - sy) > 1) continue;
      }
      const k = j * ow + i;
      lon[k] = ll[0];
      lat[k] = ll[1];
      if (ll[0] < w) w = ll[0];
      if (ll[0] > e) e = ll[0];
      if (ll[1] < s) s = ll[1];
      if (ll[1] > nth) nth = ll[1];
    }
  }
  if (!(e > w)) return null;

  // 2. Ground size of one output pixel at the centre → tile zoom with similar detail.
  const cx = frame.x + frame.w / 2;
  const cy = frame.y + frame.h / 2;
  const a = projection.invert?.([cx, cy]);
  const b = projection.invert?.([cx + 1 / pixelRatio, cy]);
  const metresPerPx =
    a && b ? Math.max(1, Math.hypot((b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180), b[1] - a[1]) * 111_320) : 40_000;
  const midLat = a ? a[1] : 0;
  let z = Math.ceil(Math.log2((156_543 * Math.cos((midLat * Math.PI) / 180)) / metresPerPx));
  z = Math.max(0, Math.min(12, z));
  const crossesDateline = e - w > 300; // world maps: take the whole globe
  const span = (zz: number) => {
    const x0 = Math.floor(lonToX(crossesDateline ? -180 : w, zz) / TILE);
    const x1 = Math.floor((lonToX(crossesDateline ? 179.999 : e, zz) - 1e-6) / TILE);
    const y0 = Math.floor(latToY(nth, zz) / TILE);
    const y1 = Math.floor((latToY(s, zz) - 1e-6) / TILE);
    return { x0, x1, y0: Math.max(0, y0), y1: Math.min((1 << zz) - 1, y1) };
  };
  let t = span(z);
  while (z > 0 && (t.x1 - t.x0 + 1) * (t.y1 - t.y0 + 1) > MAX_TILES) t = span(--z);

  // 3. Fetch the tiles and sample elevation for every pixel (bilinear). A tile that
  // won't load is filled from its parent at lower zoom — softer, but never a hole.
  const wrap = (x: number, zz: number) => ((x % (1 << zz)) + (1 << zz)) % (1 << zz);
  const tiles = new Map<string, Float32Array | null>();
  const need: [number, number, number][] = [];
  for (let x = t.x0; x <= t.x1; x++) for (let y = t.y0; y <= t.y1; y++) need.push([z, wrap(x, z), y]);
  await Promise.all(need.map(async ([zz, x, y]) => tiles.set(`${zz}/${x}/${y}`, await loadTile(zz, x, y))));
  for (let level = 1; level <= 3 && z - level >= 0; level++) {
    const parents = new Set<string>();
    for (const [key, tile] of tiles) {
      if (tile) continue;
      const [zz, x, y] = key.split("/").map(Number);
      if (zz !== z) continue;
      const pk = `${z - level}/${x >> level}/${y >> level}`;
      if (!tiles.has(pk)) parents.add(pk);
    }
    await Promise.all(
      [...parents].map(async (pk) => {
        const [zz, x, y] = pk.split("/").map(Number);
        tiles.set(pk, await loadTile(zz, x, y));
      }),
    );
  }
  if (![...tiles.values()].some(Boolean)) return null;

  const at = (px: number, py: number) => {
    for (let level = 0; level <= 3 && z - level >= 0; level++) {
      const f = 1 << level;
      const lx = px / f;
      const ly = py / f;
      const tx = Math.floor(lx / TILE);
      const ty = Math.floor(ly / TILE);
      const tile = tiles.get(`${z - level}/${wrap(tx, z - level)}/${ty}`);
      if (!tile) continue;
      const ix = Math.min(TILE - 1, Math.max(0, Math.floor(lx - tx * TILE)));
      const iy = Math.min(TILE - 1, Math.max(0, Math.floor(ly - ty * TILE)));
      return tile[iy * TILE + ix];
    }
    return NaN;
  };
  const elev = new Float32Array(ow * oh).fill(NaN);
  for (let k = 0; k < elev.length; k++) {
    if (Number.isNaN(lon[k])) continue;
    const px = lonToX(lon[k], z) - 0.5;
    const py = latToY(lat[k], z) - 0.5;
    const x0 = Math.floor(px);
    const y0 = Math.floor(py);
    const fx = px - x0;
    const fy = py - y0;
    const e00 = at(x0, y0), e10 = at(x0 + 1, y0), e01 = at(x0, y0 + 1), e11 = at(x0 + 1, y0 + 1);
    elev[k] = (e00 * (1 - fx) + e10 * fx) * (1 - fy) + (e01 * (1 - fx) + e11 * fx) * fy;
  }

  // 4. Hillshade (sun from the north-west, 45° up) and colour.
  const cell = metresPerPx;
  // Small-scale maps need exaggeration or mountains vanish; large-scale maps need little.
  const zf = (req.exaggeration ?? 1) * Math.max(1.2, Math.pow(cell / 40, 0.6));
  // Standard (ESRI) hillshade with image-space gradients: a sun at azimuth 315° is
  // 135° in the maths convention (360 − az + 90).
  const sun = ((360 - 315 + 90) * Math.PI) / 180;
  const alt = (45 * Math.PI) / 180;
  const paper = req.paper ?? [251, 248, 240];
  const want = new Set(modes);
  const atlas = want.has("atlas") ? new ImageData(ow, oh) : null;
  const shadeImg = want.has("shade") ? new ImageData(ow, oh) : null;
  const E = (i: number, j: number, fallback: number) => {
    const v = elev[Math.min(oh - 1, Math.max(0, j)) * ow + Math.min(ow - 1, Math.max(0, i))];
    return Number.isNaN(v) ? fallback : v;
  };
  for (let j = 0; j < oh; j++) {
    for (let i = 0; i < ow; i++) {
      const k = j * ow + i;
      const o = k * 4;
      const h = elev[k];
      if (Number.isNaN(h)) {
        if (atlas) {
          atlas.data[o] = paper[0];
          atlas.data[o + 1] = paper[1];
          atlas.data[o + 2] = paper[2];
          atlas.data[o + 3] = 255;
        }
        continue;
      }
      const land = h > 0;
      const dzdx = ((E(i + 1, j, h) - E(i - 1, j, h)) / (2 * cell)) * (land ? zf : zf * 0.25);
      const dzdy = ((E(i, j + 1, h) - E(i, j - 1, h)) / (2 * cell)) * (land ? zf : zf * 0.25);
      const slope = Math.atan(Math.hypot(dzdx, dzdy));
      const aspect = Math.atan2(dzdy, -dzdx);
      const shade = Math.max(
        0,
        Math.sin(alt) * Math.cos(slope) + Math.cos(alt) * Math.sin(slope) * Math.cos(sun - aspect),
      );
      if (atlas) {
        const [r, g, bl] = land ? ramp(LAND, h) : ramp(SEA, h);
        // Soft multiply: flat ground (shade ≈ 0.71) stays true to the tint.
        const f = land ? 0.55 + 0.63 * shade : 0.85 + 0.21 * shade;
        atlas.data[o] = Math.min(255, r * f);
        atlas.data[o + 1] = Math.min(255, g * f);
        atlas.data[o + 2] = Math.min(255, bl * f);
        atlas.data[o + 3] = 255;
      }
      if (shadeImg && land) {
        // Transparent shading to lay over flat colours: shadows darken, lit slopes brighten.
        const d = shade - Math.sin(alt);
        const v = d < 0 ? 40 : 255;
        shadeImg.data[o] = shadeImg.data[o + 1] = shadeImg.data[o + 2] = v;
        shadeImg.data[o + 3] = Math.min(255, Math.abs(d) * (d < 0 ? 330 : 170));
      }
    }
  }
  const encode = (img: ImageData, type: string) => {
    const canvas = document.createElement("canvas");
    canvas.width = ow;
    canvas.height = oh;
    canvas.getContext("2d")!.putImageData(img, 0, 0);
    return canvas.toDataURL(type, 0.9);
  };
  return {
    ...(atlas ? { atlas: encode(atlas, "image/jpeg") } : {}),
    ...(shadeImg ? { shade: encode(shadeImg, "image/png") } : {}),
  };
}
