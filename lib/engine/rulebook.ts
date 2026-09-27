/**
 * Step 2 of the engine: the rulebook. A written, ordered set of cartographic rules —
 * the decisions a professional cartographer makes, in the order they make them — each
 * recording what it chose and why. Given the same brief and data it always designs
 * the same map. The AI designer, when available, proposes; these rules and the
 * checks in inspect.ts dispose.
 */
import type { ColumnRoles, ParsedTable } from "@/lib/data/parse";
import { paletteKind as kindOf } from "@/lib/cartography/palettes";
import type { Decision, GeoLevel, MapSpec, MapStyle, MapType } from "@/lib/mapspec/schema";
import { parseMapSpec } from "@/lib/mapspec/schema";
import { profileTable, type DataProfile } from "@/lib/mapspec/profile";
import { referenceTitle, type Brief } from "./brief";
import { aspectOf, PORTRAIT_ABOVE, regionContaining } from "./shape";

export interface Facts {
  brief: Brief;
  table?: ParsedTable | null;
  roles?: ColumnRoles;
  /** Where the data resolver placed the data — authoritative about what the data names. */
  resolved?: { level: GeoLevel; region?: string };
  /** Title the user typed (always wins). */
  userTitle?: string;
}

export interface Design {
  spec: MapSpec;
  decisions: Decision[];
  /** Rows the brief itself implies (a list of countries), used when no table was given. */
  rows?: Record<string, unknown>[];
}

const humanize = (h: string) =>
  h.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());
const GENERIC = /^(value|values|count|number|metric|amount|total|data|column \d+)$/i;
const the = (place: string) => (/^(United|Republic|Netherlands|Philippines|Gambia|Bahamas|Central African|Czech|Dominican|Maldives|Comoros|Seychelles)/.test(place) ? `the ${place}` : place);

export function design(f: Facts): Design {
  const { brief } = f;
  const decisions: Decision[] = [];
  const log = (rule: string, topic: string, choice: string, because: string, by: Decision["by"]) =>
    decisions.push({ rule, topic, choice, because, by });

  const roles = f.roles ?? {};
  const hasTable = Boolean(f.table?.rows.length);
  const hasCoords = Boolean(roles.latField && roles.lonField);
  const hasValue = Boolean(roles.valueField);
  const hasName = Boolean(roles.nameField);
  const hasCategory = Boolean(roles.categoryField);
  const profile: DataProfile | null = hasTable && f.table ? profileTable(f.table, roles) : null;
  let rows: Record<string, unknown>[] | undefined;

  // ── G. Geography: what the data names beats what the sentence names beats the whole world ──
  let level: GeoLevel = "world";
  let region: string | undefined = "World";
  if (f.resolved) {
    level = f.resolved.level;
    region = f.resolved.region ?? (level === "world" ? "World" : undefined);
    log("G1", "Geography", describeGeo(level, region), "Read from your data: the place names in it are matched to these boundaries.", "data");
  } else if (brief.place?.kind === "country") {
    const u = brief.units?.level;
    level = u === "admin1" ? "admin1" : u === "admin2" ? "admin2" : "country";
    region = brief.place.name;
    log(
      "G2",
      "Geography",
      describeGeo(level, region),
      brief.units && (u === "admin1" || u === "admin2")
        ? `You asked for the ${brief.units.plural.toLowerCase()} of ${region}.`
        : `You named ${region}.`,
      "brief",
    );
  } else if (brief.place?.kind === "region") {
    level = "continent";
    region = brief.place.name;
    log("G2", "Geography", region, `You named ${region}; it is framed on its own, neighbours kept for context.`, "brief");
  } else if (brief.countries.length > 1) {
    const around = regionContaining(brief.countries);
    level = around ? "continent" : "world";
    region = around ?? "World";
    log("G3", "Geography", around ?? "The world", `You named ${list(brief.countries)}; the map frames ${around ? `them within ${around}` : "the world, since they span more than one region"}.`, "brief");
  } else {
    log("G4", "Geography", "The world", "No place was named, so the map shows the whole world.", "rules");
  }

  // ── T. Map type: the shape of the data, then the intent of the sentence ──
  let mapType: MapType;
  let illustrative = false;
  if (hasTable && hasCoords) {
    mapType = hasCategory ? "categorical_point" : hasValue ? "proportional_symbol" : "point";
    log("T1", "Map type", label(mapType), hasCategory ? "Your sites carry a category, so each is coloured by it." : hasValue ? "Your sites carry a quantity; circle area is drawn proportional to it, so a site with twice the value looks twice as big." : "Your data are locations, so each is marked and named.", "data");
  } else if (hasTable && hasName && hasValue) {
    const counts = profile?.value && !profile.value.looksLikeShare && brief.theme?.count;
    if (counts && level === "world") {
      mapType = "proportional_symbol";
      log("T2", "Map type", label(mapType), "Your values are totals. Shading countries of very different size by a total misleads the eye, so they are drawn as circles at each country's centre instead.", "rules");
    } else {
      mapType = "choropleth";
      log("T2", "Map type", label(mapType), counts ? "Your values are totals over areas of different size — the map shades them as asked; consider rates (per 1,000 people or per km²) for a fairer picture." : "Your data give a value for each area, so each area is shaded by it.", "data");
    }
  } else if (hasTable && hasName) {
    mapType = "footprint";
    log("T3", "Map type", label(mapType), "Your data list places without values, so those places are highlighted.", "data");
  } else if (brief.intent === "footprint" && brief.countries.length) {
    mapType = "footprint";
    rows = brief.countries.map((c) => ({ Country: c }));
    log("T3", "Map type", label(mapType), `The countries you named are highlighted: ${list(brief.countries)}.`, "brief");
  } else if (brief.intent === "thematic") {
    mapType = level === "country" || level === "city" ? "proportional_symbol" : "choropleth";
    if (mapType === "choropleth" && level === "country") level = "admin1";
    illustrative = true;
    log("T4", "Map type", label(mapType), `You described ${brief.theme ? brief.theme.label.toLowerCase() : "a subject"} but gave no numbers, so the map is drawn with clearly labelled illustrative values in the right places — replace them with your data.`, "rules");
  } else if (brief.intent === "locations") {
    mapType = "point";
    illustrative = true;
    log("T5", "Map type", label(mapType), "You described sites but gave no locations; illustrative sites are placed until you add yours.", "rules");
  } else {
    mapType = "reference";
    if (level === "country" && brief.place?.kind === "country") level = "admin1";
    log("T6", "Map type", label(mapType), "No data to show — a reference map: every unit tinted apart from its neighbours and named, the way an atlas plate is.", "rules");
  }

  // ── S. Style: what you asked for, then what the subject and map suit ──
  let style: MapStyle;
  if (brief.style) {
    style = brief.style;
    log("S1", "Style", cap(style), `You asked for a ${brief.style === "atlas" ? "physical" : brief.style === "classic" ? "political" : "minimal"} look.`, "brief");
  } else if (mapType === "reference") {
    style = level === "world" || level === "continent" ? "classic" : "atlas";
    log("S2", "Style", cap(style), style === "atlas" ? "A school-atlas plate: terrain relief under softly tinted units, rivers, lakes and towns." : "A political atlas plate: pastel countries with water-lined coasts.", "rules");
  } else if (mapType === "choropleth") {
    style = level === "admin2" ? "minimal" : level === "world" || level === "continent" ? "classic" : "atlas";
    log("S3", "Style", cap(style), style === "minimal" ? "Many small districts: paper and ink keep the data the only colour on the page." : style === "classic" ? "At world and continent scale the political atlas base frames the colours cleanly." : "Relief shading under the colours keeps the land real without changing the classes.", "rules");
  } else {
    style = "atlas";
    log("S4", "Style", "Atlas", "Sites read best on real terrain with rivers and towns for orientation.", "rules");
  }

  // ── C. Classification: from the numbers themselves ──
  let classification: MapSpec["symbology"]["classification"] = "quantile";
  let classes = 5;
  const v = profile?.value;
  if (mapType === "choropleth" && v) {
    classes = Math.max(2, Math.min(5, v.distinct, v.count >= 12 ? 5 : Math.max(3, Math.floor(v.count / 2))));
    if (Math.abs(v.skewness) > 1 || v.outliers > 0) {
      classification = "jenks";
      log("C1", "Classes", `${classes} natural breaks`, `Your values are skewed (skewness ${v.skewness}${v.outliers ? `, ${v.outliers} outlier${v.outliers > 1 ? "s" : ""}` : ""}); natural breaks keep the few high values from flattening everything else.`, "data");
    } else if (v.looksLikeShare) {
      classification = "equal_interval";
      log("C2", "Classes", `${classes} equal intervals`, "Your values are shares; equal steps read directly as percentage bands.", "data");
    } else {
      log("C3", "Classes", `${classes} quantiles`, `Your ${v.count} values are evenly spread; quantiles give each colour a similar number of places.`, "data");
    }
  } else if (mapType === "choropleth") {
    log("C4", "Classes", "5 quantiles", "Illustrative values: five classes, each holding a similar number of places.", "rules");
  }

  // ── K. Colour: your words, then the subject's convention, then the data's sign ──
  let palette = brief.theme?.palette ?? "Blues";
  let why = brief.theme ? `${brief.theme.label} is conventionally mapped in this ramp.` : "A calm sequential blue: light for low, dark for high.";
  let by: Decision["by"] = brief.theme ? "rules" : "rules";
  const crossesZero = Boolean(v && v.negatives > 0 && v.positives > 0);
  if (mapType === "footprint") {
    palette = "Oranges";
    why = "A warm tint: highlighted land reads at once against blue water and pale neighbours.";
  } else if (mapType === "categorical_point") {
    palette = "Set2";
    why = "Categories need distinct hues of equal weight, not a light-to-dark ramp.";
  } else if (crossesZero || (brief.theme?.id === "change" && !v)) {
    palette = brief.theme?.diverging ?? "RdBu";
    why = crossesZero ? "Your values run both below and above zero; a diverging ramp shows direction as well as size." : "A change is shown on a diverging ramp: one hue for decrease, one for increase.";
    by = crossesZero ? "data" : "rules";
  }
  if (brief.palette && mapType !== "categorical_point" && !crossesZero) {
    palette = brief.palette;
    why = "The colour you asked for, as a light-to-dark ramp.";
    by = "brief";
  }
  if (mapType === "choropleth" || mapType === "footprint" || mapType === "proportional_symbol" || mapType === "categorical_point")
    log("K1", "Colour", palette, why, by);

  // ── P. Page: tall places on portrait pages, wide ones on landscape ──
  let orientation: MapSpec["page"]["orientation"] = "landscape";
  if (brief.orientation) {
    orientation = brief.orientation;
    log("P1", "Page", `A4 ${orientation}`, `You asked for ${orientation}.`, "brief");
  } else {
    const a = aspectOf(level, region);
    orientation = a !== null && a > PORTRAIT_ABOVE ? "portrait" : "landscape";
    log("P2", "Page", `A4 ${orientation}`, a === null ? "Landscape suits a spread of places." : `${region === "World" ? "The world" : region} is ${a > PORTRAIT_ABOVE ? "about as tall as it is wide or taller" : "wider than it is tall"}, so the ${orientation} page lets the map fill it.`, "rules");
  }

  // ── F. Furniture: the conventions of scale ──
  const small = level === "world" || level === "continent";
  const furniture: MapSpec["furniture"] = {
    title: true,
    legend: mapType !== "reference",
    scalebar: !small,
    north_arrow: level !== "world",
    graticule: small,
    caption: false,
    source: true,
    labels: true,
  };
  log("F1", "Map elements", small ? "Graticule, no scale bar" : "Scale bar and north arrow", small ? "At world and continent scale the scale changes across the map, so a single scale bar would lie; the graticule shows the geometry instead." : "At country scale distance is meaningful, so a scale bar is shown; the grid would only clutter.", "rules");

  // ── N. Words: an atlas title, a subtitle that carries the units and date ──
  const place = region && region !== "World" ? region : undefined;
  const unitSingular = brief.units && brief.units.level !== "points" ? brief.units.singular : level === "admin2" ? "District" : level === "admin1" ? "Province" : "Country";
  const metric = roles.valueField && !GENERIC.test(roles.valueField) ? humanize(roles.valueField) : brief.theme?.label;
  let title: string;
  if (f.userTitle) title = f.userTitle;
  else if (mapType === "reference") title = referenceTitle(brief) ?? (place ? place : "The World: Political");
  else if (mapType === "footprint") title = place && level !== "world" ? `Where We Work in ${the(place)}` : "Where We Work";
  else if (mapType === "choropleth") title = `${metric ?? "Indicator"} by ${unitSingular}${place ? `, ${place}` : ""}`;
  else if (mapType === "point" || mapType === "categorical_point") title = `${brief.units?.level === "points" ? subjectOf(brief) : metric ?? "Sites"}${place ? ` in ${the(place)}` : ""}`;
  else title = `${metric ?? "Sites"}${place ? ` in ${the(place)}` : ""}`;
  const subtitleParts = [
    rows && mapType === "footprint" ? list(brief.countries) : null,
    brief.theme?.unit && mapType !== "reference" && !roles.valueField ? brief.theme.unit : null,
    brief.year,
    illustrative ? "Illustrative data — replace with your own" : null,
  ].filter(Boolean);
  log("N1", "Title", title, f.userTitle ? "Your title." : "What, by what unit, and where — the way an atlas titles a plate.", f.userTitle ? "brief" : "rules");

  const valueLabel =
    mapType === "categorical_point"
      ? roles.categoryField ? humanize(roles.categoryField) : "Type"
      : metric
        ? `${metric}${brief.theme?.unit && !roles.valueField ? ` (${brief.theme.unit})` : ""}`
        : undefined;

  const spec = parseMapSpec({
    version: 1,
    title,
    subtitle: subtitleParts.join(" · ") || undefined,
    source: illustrative ? "Illustrative data · Boundaries: Natural Earth" : hasTable ? "Data: your data · Boundaries: Natural Earth" : "Boundaries: Natural Earth",
    mapType,
    style,
    geography: { level, region },
    data: {
      nameField: roles.nameField ?? (rows ? "Country" : undefined),
      valueField: roles.valueField,
      categoryField: roles.categoryField,
      latField: roles.latField,
      lonField: roles.lonField,
      valueLabel,
      valueFormat: v?.looksLikeShare === "fraction" ? ".0%" : brief.theme?.format ?? ",",
      illustrative: illustrative || undefined,
    },
    symbology: { palette, paletteKind: kindOf(palette), classes, classification, reverse: false, minRadius: 2, maxRadius: 26 },
    furniture,
    page: { size: "A4", orientation },
    decisions,
  });
  return { spec, decisions, rows };
}

function subjectOf(b: Brief): string {
  const m = b.text.match(/\b(health facilities|facilities|clinics|hospitals|schools|offices|boreholes|wells|mines|projects|stations|branches|stores|camps|sites|locations)\b/i);
  return m ? humanize(m[1]) : "Sites";
}

function describeGeo(level: GeoLevel, region?: string): string {
  const r = region ?? "";
  switch (level) {
    case "world": return "The world";
    case "continent": return r;
    case "country": return r;
    case "admin1": return `${r} — first-level units (provinces/states)`;
    case "admin2": return `${r} — districts`;
    default: return r;
  }
}

const LABELS: Record<MapType, string> = {
  choropleth: "Shaded areas (choropleth)",
  footprint: "Highlighted places",
  proportional_symbol: "Proportional circles",
  graduated_symbol: "Graduated circles",
  dot: "Dot density",
  point: "Located sites",
  categorical_point: "Sites by category",
  reference: "Reference map (atlas plate)",
};
const label = (t: MapType) => LABELS[t];
const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : xs[0] ?? "");
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
