import { geoDistance, type GeoProjection } from "d3-geo";
import { formatKm } from "./format";

export interface ScaleBar {
  km: number;
  widthPx: number;
  label: string;
}

const EARTH_RADIUS_KM = 6371;

/**
 * A real scale bar: measure ground distance across the map centre, pick a nice
 * round number (1·2·5 × 10ⁿ) that fits in ~targetPx, and return its pixel width.
 */
export function computeScaleBar(
  projection: GeoProjection,
  width: number,
  height: number,
  targetPx = 150,
): ScaleBar | null {
  if (!projection.invert) return null;
  const cx = width / 2;
  const cy = height / 2;
  const a = projection.invert([cx, cy]);
  const b = projection.invert([cx + 60, cy]);
  if (!a || !b) return null;

  const kmOver60 = geoDistance(a, b) * EARTH_RADIUS_KM;
  const kmPerPx = kmOver60 / 60;
  if (!Number.isFinite(kmPerPx) || kmPerPx <= 0) return null;

  const nice = niceRound(kmPerPx * targetPx);
  const widthPx = nice / kmPerPx;
  if (!Number.isFinite(widthPx) || widthPx <= 0) return null;

  const label = nice >= 1 ? `${formatKm(nice)} km` : `${Math.round(nice * 1000)} m`;
  return { km: nice, widthPx, label };
}

function niceRound(x: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(x)));
  const f = x / pow;
  const nf = f >= 5 ? 5 : f >= 2 ? 2 : 1;
  return nf * pow;
}
