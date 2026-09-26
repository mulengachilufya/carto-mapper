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
 * bounds for countries/provinces, Lambert azimuthal for continents, Equal Earth for
 * the world, and Mercator
 * only at city scale. The projection is then fitted to the given drawing extent.
 */
export function chooseProjection(
  level: GeoLevel,
  fitObject: GeoPermissibleObjects,
  extent: [[number, number], [number, number]],
  hint?: string,
): GeoProjection {
  const [[lon0, lat0], [lon1Raw, lat1]] = geoBounds(fitObject);
  // geoBounds reports extents that cross the antimeridian (e.g. the USA's Aleutians,
  // Russia, Fiji) as lon1 < lon0; unwrap so the centre lands on the right side of the globe.
  const lon1 = lon1Raw < lon0 ? lon1Raw + 360 : lon1Raw;
  const lonMid = (lon0 + lon1) / 2;
  const lonC = lonMid > 180 ? lonMid - 360 : lonMid;
  const latC = (lat0 + lat1) / 2;
  const latSpan = Math.abs(lat1 - lat0);
  const h = (hint || "").toLowerCase();

  let projection: GeoProjection;

  if (h.includes("mercator") || level === "city") {
    projection = geoMercator();
  } else if (h.includes("equalearth") || h.includes("equal_earth") || level === "world") {
    projection = geoEqualEarth();
  } else if (h.includes("azimuthal") || level === "continent") {
    // Lambert azimuthal equal-area centred on the region — the standard for continents.
    projection = geoAzimuthalEqualArea().rotate([-lonC, -latC]);
  } else {
    // country / admin1 / admin2 / regional → equal-area conic fitted to bounds
    const p1 = lat0 + latSpan / 6;
    const p2 = lat1 - latSpan / 6;
    projection = geoConicEqualArea().parallels([p1, p2]).rotate([-lonC, 0]).center([0, latC]);
  }

  projection.fitExtent(extent, fitObject);
  return projection;
}
