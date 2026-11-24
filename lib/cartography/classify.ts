import { ckmeans } from "simple-statistics";
import type { Classification } from "@/lib/mapspec/schema";

export interface ClassBreaks {
  method: Classification;
  breaks: number[]; // length = classes + 1: [min, t1, …, max]
  classes: number;
}

/**
 * Turn raw values into class breaks using a real cartographic method:
 *  - quantile       , equal count per class (good for skewed data)
 *  - equal_interval , equal value range per class
 *  - jenks          , natural breaks (ckmeans), minimises within-class variance
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

  const cuts: number[] = [];
  if (method === "equal_interval") {
    for (let i = 1; i < classes; i++) {
      const t = i / classes;
      cuts.push(min * (1 - t) + max * t);
    }
  } else if (method === "jenks") {
    const clusters = ckmeans(values, classes);
    for (let i = 1; i < clusters.length; i++) {
      cuts.push(between(clusters[i - 1].at(-1)!, clusters[i][0]));
    }
  } else {
    // Keep tied observations together at the nearest usable rank boundary.
    const splits = values.flatMap((value, i) => i > 0 && value !== values[i - 1] ? [i] : []);
    let i = 0;
    for (let group = 1; group < classes; group++) {
      const rank = values.length * group / classes;
      while (i + 1 < splits.length && Math.abs(splits[i + 1] - rank) < Math.abs(splits[i] - rank)) i++;
      cuts.push(between(values[splits[i] - 1], values[splits[i]]));
    }
  }
  const breaks = [min, ...Array.from(new Set(cuts.filter((cut) => cut > min && cut <= max))), max];
  return { method, breaks, classes: breaks.length - 1 };
}

/** A half-open boundary that keeps two neighboring observations in distinct classes. */
function between(lower: number, upper: number): number {
  const midpoint = lower / 2 + upper / 2;
  return midpoint > lower ? midpoint : upper;
}

/** Which class (0-based) a value falls in, given breaks of length classes+1. */
export function classIndex(value: number, breaks: number[]): number {
  for (let i = 1; i < breaks.length - 1; i++) {
    if (value < breaks[i]) return i - 1;
  }
  return breaks.length - 2;
}
