/**
 * The engine's vocabulary: the words people use for places, units, subjects, colours
 * and looks, mapped to cartographic meaning. Everything here is plain data so the
 * rules that use it stay readable, and so it can grow without touching logic.
 */
import type { MapStyle } from "@/lib/mapspec/schema";

export type UnitLevel = "admin1" | "admin2" | "countries" | "points";

/** Words for subdivisions → the boundary level that usually carries them. */
export const UNIT_WORDS: { re: RegExp; level: UnitLevel; singular: string; plural: string }[] = [
  { re: /\bprovinces?\b|\bprovincial\b/, level: "admin1", singular: "Province", plural: "Provinces" },
  { re: /\bstates?\b(?!\s+of\s+the\s+art)/, level: "admin1", singular: "State", plural: "States" },
  { re: /\bregions?\b|\bregional\b/, level: "admin1", singular: "Region", plural: "Regions" },
  { re: /\bgovernorates?\b/, level: "admin1", singular: "Governorate", plural: "Governorates" },
  { re: /\bprefectures?\b/, level: "admin1", singular: "Prefecture", plural: "Prefectures" },
  { re: /\boblasts?\b/, level: "admin1", singular: "Oblast", plural: "Oblasts" },
  { re: /\bcantons?\b/, level: "admin1", singular: "Canton", plural: "Cantons" },
  { re: /\bdepartments?\b|\bdépartements?\b/, level: "admin1", singular: "Department", plural: "Departments" },
  { re: /\bcounties\b|\bcounty\b/, level: "admin2", singular: "County", plural: "Counties" },
  { re: /\bdistricts?\b/, level: "admin2", singular: "District", plural: "Districts" },
  { re: /\bmunicipalit(?:y|ies)\b/, level: "admin2", singular: "Municipality", plural: "Municipalities" },
  { re: /\bconstituenc(?:y|ies)\b/, level: "admin2", singular: "Constituency", plural: "Constituencies" },
  { re: /\blgas?\b|\blocal government areas?\b/, level: "admin2", singular: "LGA", plural: "LGAs" },
  { re: /\bcountries\b|\bnations\b|\bcountry\b|\bnational\b|\bmember states\b/, level: "countries", singular: "Country", plural: "Countries" },
  { re: /\b(sites?|locations?|facilit(?:y|ies)|clinics?|hospitals?|schools?|offices?|boreholes?|wells?|mines?|cities|towns?|villages?|stations?|branches?|stores?|shops?|projects?|points?|camps?)\b/, level: "points", singular: "Site", plural: "Sites" },
];

/**
 * Where a country's own first-level units have a different official name, or its
 * districts are first-level. geoBoundaries ADM1/ADM2 follow national usage.
 */
export const ADM1_NAME: Record<string, [string, string]> = {
  zambia: ["Province", "Provinces"], "south africa": ["Province", "Provinces"], "dem rep congo": ["Province", "Provinces"],
  canada: ["Province", "Provinces"], china: ["Province", "Provinces"], argentina: ["Province", "Provinces"],
  pakistan: ["Province", "Provinces"], "sri lanka": ["Province", "Provinces"], philippines: ["Region", "Regions"],
  kenya: ["County", "Counties"], liberia: ["County", "Counties"], ireland: ["County", "Counties"],
  "united states of america": ["State", "States"], nigeria: ["State", "States"], india: ["State", "States"],
  brazil: ["State", "States"], mexico: ["State", "States"], australia: ["State", "States"], malaysia: ["State", "States"],
  germany: ["State", "States"], "s sudan": ["State", "States"], sudan: ["State", "States"],
  ghana: ["Region", "Regions"], tanzania: ["Region", "Regions"], malawi: ["Region", "Regions"], senegal: ["Region", "Regions"],
  mali: ["Region", "Regions"], ethiopia: ["Region", "Regions"], uganda: ["Region", "Regions"], namibia: ["Region", "Regions"],
  france: ["Region", "Regions"], italy: ["Region", "Regions"], chile: ["Region", "Regions"], peru: ["Region", "Regions"],
  morocco: ["Region", "Regions"], egypt: ["Governorate", "Governorates"], iraq: ["Governorate", "Governorates"],
  jordan: ["Governorate", "Governorates"], yemen: ["Governorate", "Governorates"], japan: ["Prefecture", "Prefectures"],
  russia: ["Region", "Regions"], ukraine: ["Oblast", "Oblasts"], kazakhstan: ["Region", "Regions"],
  switzerland: ["Canton", "Cantons"], colombia: ["Department", "Departments"], bolivia: ["Department", "Departments"],
  guatemala: ["Department", "Departments"], botswana: ["District", "Districts"], "sierra leone": ["Province", "Provinces"],
  zimbabwe: ["Province", "Provinces"], mozambique: ["Province", "Provinces"], angola: ["Province", "Provinces"],
  rwanda: ["Province", "Provinces"], burundi: ["Province", "Provinces"], cameroon: ["Region", "Regions"],
  madagascar: ["Region", "Regions"], "united kingdom": ["Country", "Countries"], spain: ["Community", "Communities"],
  indonesia: ["Province", "Provinces"], vietnam: ["Province", "Provinces"], thailand: ["Province", "Provinces"],
  iran: ["Province", "Provinces"], turkey: ["Province", "Provinces"], afghanistan: ["Province", "Provinces"],
};

/** "Districts of Botswana" are its first level; "counties of Kenya" too. */
export const WORD_IS_ADM1: Record<string, string[]> = {
  kenya: ["County", "Counties"], liberia: ["County", "Counties"], ireland: ["County", "Counties"],
  botswana: ["District", "Districts"],
};

export interface Theme {
  id: string;
  label: string; // legend title / title subject
  unit?: string; // shown in the legend title
  palette: string; // ColorBrewer sequential ramp
  diverging?: string; // ramp to use when values cross a midpoint
  format?: string;
  /** A total rather than a rate, misleads as a choropleth over units of unequal size. */
  count?: boolean;
  style?: MapStyle;
}

/** Subjects → how atlases conventionally colour them. First match wins, so specific before general. */
export const THEMES: { re: RegExp; theme: Theme }[] = [
  { re: /population density|people per (?:km|sq)|density/, theme: { id: "density", label: "Population Density", unit: "people per km²", palette: "YlOrRd", format: ",.0f" } },
  { re: /internet|broadband|\b[345]g\b|mobile coverage|network coverage|connectivity|smartphone/, theme: { id: "digital", label: "Internet Use", unit: "%", palette: "PuBu", format: ".0f" } },
  { re: /inflation|consumer prices|\bcpi\b|cost of living/, theme: { id: "inflation", label: "Inflation Rate", unit: "%", palette: "OrRd", format: ".1f" } },
  { re: /mobile money|financial inclusion|bank accounts|accounts per|unbanked/, theme: { id: "inclusion", label: "Account Ownership", palette: "BuGn", format: ".0f" } },
  { re: /deposits|sales|revenue|turnover|loans|portfolio/, theme: { id: "business", label: "Sales", palette: "Greens", format: ",", count: true } },
  { re: /people in need|affected people|displaced|refugees|\bidps?\b|food insecur/, theme: { id: "humanitarian", label: "People in Need", palette: "OrRd", format: ",", count: true } },
  { re: /house prices?|home (?:values?|prices?)|property prices?|\brents?\b|real estate|per m²|per sq/, theme: { id: "housing", label: "House Price", palette: "YlGnBu", format: ",.0f" } },
  { re: /population|inhabitants|residents/, theme: { id: "population", label: "Population", palette: "YlOrBr", format: ".3s", count: true } },
  { re: /rain(?:fall)?|precipitation/, theme: { id: "rainfall", label: "Annual Rainfall", unit: "mm", palette: "GnBu", format: ",.0f" } },
  { re: /temperature|heat|warm/, theme: { id: "temperature", label: "Mean Temperature", unit: "°C", palette: "YlOrRd", diverging: "RdYlBu", format: ".1f" } },
  { re: /drought|aridity/, theme: { id: "drought", label: "Drought Severity", palette: "YlOrBr", diverging: "BrBG" } },
  { re: /poverty|poor\b|deprivation/, theme: { id: "poverty", label: "Poverty Rate", unit: "%", palette: "OrRd", format: ".0f" } },
  { re: /malaria|hiv|aids|cholera|tb\b|tuberculosis|disease|cases|infection|covid|outbreak|mortality|deaths/, theme: { id: "health-burden", label: "Cases", palette: "Reds", format: "," } },
  { re: /vaccin|immuni[sz]ation|coverage/, theme: { id: "coverage", label: "Coverage", unit: "%", palette: "BuGn", format: ".0f" } },
  { re: /literacy|education|enrol+ment|school attendance|exam|pass rate/, theme: { id: "education", label: "Literacy Rate", unit: "%", palette: "PuBu", format: ".0f" } },
  { re: /water access|safe water|piped water|drinking water|tap water|sanitation|wash\b|toilets?|latrines?/, theme: { id: "water", label: "Access to Safe Water", unit: "%", palette: "GnBu", format: ".0f" } },
  { re: /forest|deforestation|tree cover|vegetation|ndvi/, theme: { id: "forest", label: "Forest Cover", unit: "%", palette: "Greens", diverging: "BrBG", format: ".0f" } },
  { re: /gdp|income|wealth|economic|economy|earnings|revenue/, theme: { id: "economy", label: "GDP per Capita", unit: "US$", palette: "BuGn", format: "$,.0f" } },
  { re: /unemploy|jobless/, theme: { id: "unemployment", label: "Unemployment Rate", unit: "%", palette: "PuRd", format: ".1f" } },
  { re: /coffee|cocoa|\btea\b|wine|vineyards?|cotton/, theme: { id: "commodity", label: "Production", palette: "YlOrBr", format: ",.0f", count: true } },
  { re: /maize|\brice\b|wheat|crop|yield|harvest|agricultur|farm|livestock|cattle/, theme: { id: "agriculture", label: "Crop Yield", unit: "t/ha", palette: "YlGn", format: ".1f" } },
  { re: /mining|minerals?|copper|gold|cobalt/, theme: { id: "mining", label: "Mineral Output", palette: "YlOrBr", format: ".3s" } },
  { re: /crime|conflict|violence|incidents?|attacks?/, theme: { id: "conflict", label: "Incidents", palette: "Reds", format: ",", count: true } },
  { re: /elections?|votes?|voting|turnout/, theme: { id: "election", label: "Turnout", unit: "%", palette: "Purples", format: ".0f" } },
  { re: /tourism|tourists?|visitors?/, theme: { id: "tourism", label: "Visitors", palette: "PuRd", format: ".3s", count: true } },
  { re: /renewables?|solar|wind (?:power|farms?)|hydropower|clean energy/, theme: { id: "renewables", label: "Renewable Share", unit: "%", palette: "YlGn", format: ".0f" } },
  { re: /energy|electricity|electrification/, theme: { id: "energy", label: "Electricity Access", unit: "%", palette: "YlOrBr", format: ".0f" } },
  { re: /growth|change|increase|decrease|trend|gain|loss|swing|difference|anomaly/, theme: { id: "change", label: "Change", unit: "%", palette: "Blues", diverging: "RdBu", format: "+.1f" } },
  { re: /elevation|altitude|terrain|relief|mountains?|topograph|physical/, theme: { id: "physical", label: "Elevation", palette: "YlGn", style: "atlas" } },
];

/** Colour words → a sequential ramp in that hue. */
export const COLOUR_WORDS: { re: RegExp; palette: string }[] = [
  { re: /\bgreens?\b|\bgreenish\b/, palette: "Greens" },
  { re: /\bblues?\b|\bbluish\b|\bnavy\b/, palette: "Blues" },
  { re: /\breds?\b|\bcrimson\b/, palette: "Reds" },
  { re: /\bpurples?\b|\bviolet\b/, palette: "Purples" },
  { re: /\boranges?\b/, palette: "Oranges" },
  { re: /\bbrowns?\b|\bearthy\b|\bearth tones?\b/, palette: "YlOrBr" },
  { re: /\bgr[ae]ys?\b|\bmonochrome\b|\bblack and white\b/, palette: "Greys" },
  { re: /\bteal\b|\bturquoise\b/, palette: "GnBu" },
  { re: /\bpinks?\b/, palette: "RdPu" },
];

/** Look words → a base-map style. */
export const STYLE_WORDS: { re: RegExp; style: MapStyle }[] = [
  { re: /\bnight\b|\bdark\b|\bneon\b|\bglow\w*\b|\bblack background\b/, style: "night" },
  { re: /\bdot[- ]?matrix\b|\bdotted\b|\bhalftone\b|\bpixel\w*\b/, style: "dots" },
  { re: /\beditorial\b|\bmagazine\b|\bnewspaper\b|\bnewsroom\b|\binfographic\b|\bflat\b|\bmodern\b|\bclean\b|\bsimple\b/, style: "editorial" },
  { re: /\bminimal\b|\bplain\b|\bmonochrome\b|\bacademic\b|\bjournal\b/, style: "minimal" },
  { re: /\bpolitical\b|\bpastel\b|\bclassic\b|\badministrative\b/, style: "classic" },
  { re: /\bphysical\b|\bterrain\b|\brelief\b|\btopograph\w*\b|\bschool atlas\b|\batlas\b/, style: "atlas" },
];

/** Region names the renderer can frame (see CONTINENT_BBOX), with their display form. */
export const REGIONS: { re: RegExp; name: string }[] = [
  { re: /\beast(?:ern)? africa\b/, name: "East Africa" },
  { re: /\bwest(?:ern)? africa\b/, name: "West Africa" },
  { re: /\bsouthern africa\b|\bsadc\b/, name: "Southern Africa" },
  { re: /\bcentral africa\b/, name: "Central Africa" },
  { re: /\bmiddle east\b|\bmena\b/, name: "Middle East" },
  { re: /\bcentral america\b/, name: "Central America" },
  { re: /\bcaribbean\b/, name: "Caribbean" },
  { re: /\blatin america\b/, name: "Latin America" },
  { re: /\bsouth america\b/, name: "South America" },
  { re: /\bnorth america\b/, name: "North America" },
  { re: /\bsub-saharan africa\b|\bafrica\b|\bafrican\b/, name: "Africa" },
  { re: /\bnordic(?:s| countries)?\b|\bscandinavia\b/, name: "Nordics" },
  { re: /\bwestern europe\b/, name: "Western Europe" },
  { re: /\beastern europe\b/, name: "Eastern Europe" },
  { re: /\bbalkans?\b/, name: "Balkans" },
  { re: /\beurope\b|\beuropean\b|\beu\b/, name: "Europe" },
  { re: /\bsouth-?east asia\b|\basean\b/, name: "Southeast Asia" },
  { re: /\bsouth asia\b/, name: "South Asia" },
  { re: /\beast asia\b/, name: "East Asia" },
  { re: /\bcentral asia\b/, name: "Central Asia" },
  { re: /\basia\b|\basian\b/, name: "Asia" },
  { re: /\boceania\b|\bpacific islands\b/, name: "Oceania" },
];

export const WORLD_WORDS = /\bworld\b|\bglobal\b|\bworldwide\b|\binternational\b|\bevery country\b|\ball countries\b/;
