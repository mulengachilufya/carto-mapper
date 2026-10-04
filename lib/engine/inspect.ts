/**
 * Step 3 of the engine: the checks. Every map spec, the rulebook's or the AI
 * designer's, passes through these before anyone sees it. Each check either passes
 * silently or corrects the spec and says why, so a map can never contradict what was
 * asked (a "Provinces of Zambia" drawn as a world map) or break a cartographic rule.
 */
import type { Decision, MapSpec } from "@/lib/mapspec/schema";
import { parseMapSpec } from "@/lib/mapspec/schema";
import { normalizeName } from "@/lib/cartography/geo";
import { paletteKind } from "@/lib/cartography/palettes";
import type { DataProfile } from "@/lib/mapspec/profile";
import type { Brief } from "./brief";
import { aspectOf, countryFeature, isKnownRegion, PORTRAIT_ABOVE } from "./shape";

export interface InspectContext {
  brief: Brief;
  profile: DataProfile | null;
  /** Where the data resolver placed the data (outranks the sentence). */
  resolved?: { level: string; region?: string };
  /** What the rulebook decided, the reference the checks hold the AI to. */
  reference: MapSpec;
  /** Fields the user set explicitly this time (never "corrected"). */
  userSet?: { title?: boolean; orientation?: boolean; furniture?: boolean; style?: boolean; palette?: boolean };
}

const SEQ_FOR_DIV: Record<string, string> = { RdBu: "Blues", RdYlBu: "YlOrRd", BrBG: "YlGn", PiYG: "PuRd", PRGn: "Greens", RdYlGn: "YlGn", Spectral: "YlGnBu", PuOr: "Oranges", RdGy: "Greys" };

export function inspect(input: MapSpec, ctx: InspectContext): { spec: MapSpec; fixes: Decision[] } {
  const s = parseMapSpec(input);
  const ref = ctx.reference;
  const fixes: Decision[] = [];
  const fix = (rule: string, topic: string, choice: string, because: string) => fixes.push({ rule, topic, choice, because, by: "check" });
  const same = (a?: string, b?: string) => normalizeName(a ?? "") === normalizeName(b ?? "");

  // Q1, The map is of the place that was asked for (the data's place, else the sentence's).
  const wantLevel = ref.geography.level;
  const wantRegion = ref.geography.region;
  const explicit = Boolean(ctx.resolved || ctx.brief.place || ctx.brief.countries.length > 1);
  if (explicit && (!same(s.geography.region, wantRegion) || geoRank(s.geography.level) !== geoRank(wantLevel))) {
    const was = `${s.geography.level}${s.geography.region ? ` / ${s.geography.region}` : ""}`;
    s.geography = { ...s.geography, level: wantLevel, region: wantRegion };
    fix("Q1", "Geography", `${wantRegion ?? "World"} (${wantLevel})`, `The design framed ${was}, but ${ctx.resolved ? "your data is about" : "you asked for"} ${wantRegion ?? "the world"}${wantLevel === "admin1" ? " at first-level units" : wantLevel === "admin2" ? " at district level" : ""}.`);
  }

  // Q2, The place exists in the boundary data (a typo must not produce an empty page).
  if ((s.geography.level === "country" || s.geography.level === "admin1" || s.geography.level === "admin2") && s.geography.region && !countryFeature(s.geography.region)) {
    const was = s.geography.region;
    s.geography = { level: "world", region: "World" };
    fix("Q2", "Geography", "The world", `"${was}" isn't a country in the boundary data, so the map falls back to the world rather than an empty frame.`);
  } else if (s.geography.level === "continent" && s.geography.region && !isKnownRegion(s.geography.region)) {
    s.geography = { ...s.geography, level: "world", region: "World" };
    fix("Q2", "Geography", "The world", `"${input.geography.region}" isn't a region the atlas can frame.`);
  }

  // Q3, The map type fits the data actually present.
  const d = s.data;
  const hasPts = Boolean(d.latField && d.lonField);
  const needsValue = s.mapType === "choropleth" || s.mapType === "proportional_symbol" || s.mapType === "graduated_symbol";
  if (!d.illustrative && needsValue && !d.valueField && !(ref.data.illustrative)) {
    s.mapType = ref.mapType;
    fix("Q3", "Map type", s.mapType, "The chosen map type needs a number for every place, and the data has none.");
  }
  if ((s.mapType === "point" || s.mapType === "categorical_point" || s.mapType === "dot") && !hasPts && !d.nameField && !d.illustrative) {
    s.mapType = ref.mapType;
    fix("Q3", "Map type", s.mapType, "Site maps need coordinates or place names, and the data has neither.");
  }
  if (s.mapType === "categorical_point" && !d.categoryField) {
    s.mapType = d.valueField ? "proportional_symbol" : "point";
    fix("Q3", "Map type", s.mapType, "No category column to colour sites by.");
  }

  // Q4, No more classes than the data has distinct values; at most seven (the eye can't tell more apart).
  const v = ctx.profile?.value;
  if (s.mapType === "choropleth") {
    const max = Math.min(7, v ? Math.max(2, v.distinct) : 7);
    if (s.symbology.classes > max || s.symbology.classes < 2) {
      const was = s.symbology.classes;
      s.symbology = { ...s.symbology, classes: Math.max(2, Math.min(max, s.symbology.classes)) };
      fix("Q4", "Classes", String(s.symbology.classes), v && v.distinct < was ? `Your data has only ${v.distinct} distinct values, so ${was} classes would leave some empty.` : "Seven classes is the most the eye can reliably tell apart.");
    }
  }

  // Q5, Diverging colours only when the data crosses a meaningful midpoint.
  if (v && paletteKind(s.symbology.palette) === "diverging" && !(v.negatives > 0 && v.positives > 0) && ctx.brief.theme?.id !== "change") {
    const was = s.symbology.palette;
    const seq = SEQ_FOR_DIV[was] ?? "Blues";
    s.symbology = { ...s.symbology, palette: seq, paletteKind: "sequential" };
    fix("Q5", "Colour", seq, `A diverging ramp (${was}) implies values on both sides of a midpoint; yours are all ${v.negatives ? "negative" : "positive"}, so a sequential ramp is honest.`);
  }
  if (s.mapType === "categorical_point" && paletteKind(s.symbology.palette) !== "qualitative") {
    s.symbology = { ...s.symbology, palette: "Set2", paletteKind: "qualitative" };
    fix("Q5", "Colour", "Set2", "Categories need distinct hues, not a light-to-dark ramp that implies an order.");
  }
  s.symbology = { ...s.symbology, paletteKind: paletteKind(s.symbology.palette) };

  // Q6, Furniture follows scale.
  const small = s.geography.level === "world" || s.geography.level === "continent";
  if (!ctx.userSet?.furniture) {
    if (small && s.furniture.scalebar) {
      s.furniture = { ...s.furniture, scalebar: false };
      fix("Q6", "Map elements", "No scale bar", "At world and continent scale the scale varies across the map, so one scale bar would be wrong somewhere.");
    }
    if (!small && s.furniture.graticule) {
      s.furniture = { ...s.furniture, graticule: false };
      fix("Q6", "Map elements", "No graticule", "At country scale a latitude/longitude grid adds clutter without helping the reader.");
    }
    if (s.mapType === "reference" && s.furniture.legend) s.furniture = { ...s.furniture, legend: false };
    if (s.mapType !== "reference" && !s.furniture.legend) {
      s.furniture = { ...s.furniture, legend: true };
      fix("Q6", "Map elements", "Legend on", "A map that encodes data needs a legend to be read.");
    }
  }

  // Q7, Page follows the place's shape (unless you chose).
  if (!ctx.userSet?.orientation && !ctx.brief.orientation) {
    const a = aspectOf(s.geography.level, s.geography.region);
    const want = a !== null && a > PORTRAIT_ABOVE ? "portrait" : a !== null ? "landscape" : null;
    if (want && want !== s.page.orientation) {
      s.page = { ...s.page, orientation: want };
      fix("Q7", "Page", `A4 ${want}`, `${s.geography.region ?? "The map"} is ${want === "portrait" ? "taller than wide" : "wider than tall"}; the other orientation would leave much of the page empty.`);
    }
  }

  // Q8, The title names the place of a single-place map.
  const region = s.geography.region;
  if (!ctx.userSet?.title && region && region !== "World" && s.geography.level !== "world") {
    const words = normalizeName(region).split(" ").filter((w) => w.length > 2);
    if (!words.some((w) => normalizeName(s.title).includes(w))) {
      const was = s.title;
      s.title = ref.title && normalizeName(ref.title).includes(words[0] ?? "") ? ref.title : `${s.title}, ${region}`;
      fix("Q8", "Title", s.title, `"${was}" didn't say where the map is.`);
    }
  }
  if (!s.title.trim() || /^untitled|^map of data$|^indicator/i.test(s.title.trim())) {
    s.title = ref.title;
    fix("Q8", "Title", s.title, "A generic title tells the reader nothing.");
  }

  // Q9, A data map's legend says what the numbers are.
  if (s.mapType !== "reference" && s.mapType !== "footprint" && s.mapType !== "point" && !s.data.valueLabel?.trim() && ref.data.valueLabel) {
    s.data = { ...s.data, valueLabel: ref.data.valueLabel };
    fix("Q9", "Legend", ref.data.valueLabel, "The legend needs to name the measure and its unit.");
  }

  // Q10, Illustrative maps say so on the page.
  if (s.data.illustrative && !/illustrative/i.test(`${s.subtitle ?? ""} ${s.source ?? ""}`)) {
    s.subtitle = [s.subtitle, "Illustrative data. Replace with your own"].filter(Boolean).join(" · ");
    fix("Q10", "Honesty", "Marked illustrative", "Sample values must never be mistaken for real data.");
  }

  return { spec: parseMapSpec(s), fixes };
}

/** admin levels that the renderer draws the same way count as one. */
function geoRank(level: string): string {
  return level === "city" ? "country" : level;
}
