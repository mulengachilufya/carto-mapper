"use client";

import { useEffect, useState } from "react";
import type { FeatureCollection } from "geojson";
import type { MapSpec } from "@/lib/mapspec/schema";
import { findCountry, loadSubdivisions } from "@/lib/cartography/geo";
import type { Subdivisions } from "@/lib/cartography/join";

const SUB_NATIONAL = new Set(["country", "admin1", "admin2", "city"]);
const REGION_TYPES = new Set(["choropleth", "footprint"]);

/**
 * Province/district boundaries for the country a map is about. Provinces are always
 * fetched (they give country maps their internal context lines); districts only when
 * the map shades regions, since they are larger and only matter for a join.
 */
export function useSubdivisions(
  spec: MapSpec | null | undefined,
  geo: FeatureCollection | null,
): Subdivisions | undefined {
  const region = spec?.geography.region ?? "";
  const country = spec && geo && region && SUB_NATIONAL.has(spec.geography.level) ? findCountry(geo, region) : undefined;
  const name = country?.properties.name;
  const wantDistricts = Boolean(spec && REGION_TYPES.has(spec.mapType));
  const [subs, setSubs] = useState<{ key: string; value: Subdivisions } | null>(null);
  const key = `${name}|${wantDistricts}`;

  useEffect(() => {
    if (!name) return;
    let active = true;
    Promise.all([loadSubdivisions(name, 1), wantDistricts ? loadSubdivisions(name, 2) : undefined]).then(
      ([adm1, adm2]) => active && setSubs({ key, value: { adm1, adm2 } }),
    );
    return () => {
      active = false;
    };
  }, [name, wantDistricts, key]);

  return name && subs?.key === key ? subs.value : undefined;
}
