import { ckmeans } from "simple-statistics";
import type { Classification } from "@/lib/mapspec/schema";

export interface ClassBreaks {
  method: Classification;
  breaks: number[]; // length = classes + 1: [min, t1, …, max]
  classes: number;
}

/**
 * Turn raw values into class breaks using a real cartographic method:
 *  - quantile        — equal count per class (good for skewed data)
 *  - equal_interval  — equal value range per class
 *  - jenks           — natural breaks (ckmeans), minimises within-class variance
 */
export function classify(
  rawValues: number[],
  method: Classification,
  desiredClasses: number,
): ClassBreaks {
  const values = rawValues.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (values.length === 0) return { method, breaks: [0, 1], classes: 1 };

  const uniq = Array.from(new Set(values));
  const min = values[0];
  const max = values[values.length - 1];
  const classes = Math.max(1, Math.min(desiredClasses, uniq.length));
  if (classes === 1 || min === max) return { method, breaks: [min, max], classes: 1 };

  let breaks: number[];
  if (method === "equal_interval") {
    breaks = [];
    for (let i = 0; i <= classes; i++) breaks.push(min + ((max - min) * i) / classes);
  } else if (method === "jenks") {
    const clusters = ckmeans(values, classes);
    breaks = [min, ...clusters.map((c) => c[c.length - 1])];
    breaks[breaks.length - 1] = max;
  } else {
    // quantile
    breaks = [min];
    for (let i = 1; i < classes; i++) {
      const idx = Math.max(0, Math.min(values.length - 1, Math.floor((values.length * i) / classes) - 1));
      breaks.push(values[idx]);
    }
    breaks.push(max);
  }

  return finalize(method, makeMonotonic(breaks));
}

function finalize(method: Classification, breaks: number[]): ClassBreaks {
  return { method, breaks, classes: breaks.length - 1 };
}

function makeMonotonic(breaks: number[]): number[] {
  const out = [breaks[0]];
  for (let i = 1; i < breaks.length; i++) {
    if (breaks[i] > out[out.length - 1]) out.push(breaks[i]);
  }
  if (out.length < 2) out.push(out[0] + 1);
  return out;
}

/** Which class (0-based) a value falls in, given breaks of length classes+1. */
export function classIndex(value: number, breaks: number[]): number {
  for (let i = 1; i < breaks.length - 1; i++) {
    if (value < breaks[i]) return i - 1;
  }
  return breaks.length - 2;
}
