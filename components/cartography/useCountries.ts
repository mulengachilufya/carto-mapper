"use client";

import { useEffect, useState } from "react";
import type { FeatureCollection } from "geojson";
import { loadCountries } from "@/lib/cartography/geo";

/** Load Natural Earth countries once on the client; cached across components. */
export function useCountries(detail: "110m" | "50m" = "50m") {
  const [geo, setGeo] = useState<FeatureCollection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadCountries(detail)
      .then((g) => active && setGeo(g))
      .catch((e) => active && setError(String(e)));
    return () => {
      active = false;
    };
  }, [detail]);

  return { geo, error };
}
