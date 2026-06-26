import {
  geoEqualEarth,
  geoConicEqualArea,
  geoMercator,
  geoAzimuthalEqualArea,
  geoBounds,
  type GeoProjection,
  type GeoPermissibleObjects,
} from "d3-geo";
import type { GeoLevel } from "@/lib/mapspec/schema";

/**
 * Choose a projection the way a cartographer would: equal-area for thematic maps
 * (never Web Mercator for data), an equal-area conic fitted to the region's own
 * bounds for countries/provinces, Equal Earth for world/continent, and Mercator
 * only at city scale. The projection is then fitted to the drawing extent.
 */
export function chooseProjection(
  level: GeoLevel,
  fitObject: GeoPermissibleObjects,
  width: number,
  height: number,
  margin: number,
  hint?: string,
): GeoProjection {
  const [[lon0, lat0], [lon1, lat1]] = geoBounds(fitObject);
  const lonC = (lon0 + lon1) / 2;
  const latC = (lat0 + lat1) / 2;
  const latSpan = Math.abs(lat1 - lat0);
  const h = (hint || "").toLowerCase();

  let projection: GeoProjection;

  if (h.includes("mercator") || level === "city") {
    projection = geoMercator();
  } else if (h.includes("equalearth") || h.includes("equal_earth") || level === "world") {
    projection = geoEqualEarth();
  } else if (h.includes("azimuthal")) {
    projection = geoAzimuthalEqualArea().rotate([-lonC, -latC]);
  } else if (level === "continent" && latSpan > 55) {
    projection = geoEqualEarth();
  } else {
    // country / admin1 / admin2 / regional → equal-area conic fitted to bounds
    const p1 = lat0 + latSpan / 6;
    const p2 = lat1 - latSpan / 6;
    projection = geoConicEqualArea().parallels([p1, p2]).rotate([-lonC, 0]).center([0, latC]);
  }

  projection.fitExtent(
    [
      [margin, margin],
      [width - margin, height - margin],
    ],
    fitObject,
  );
  return projection;
}
