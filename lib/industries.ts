/**
 * Industry question trees. Each industry has exactly 5 controlled questions
 * (dropdown / radio / multi-select — never free text; the free text lives in the
 * separate "vibe" prompt). Answers are stored in `answers` jsonb keyed by question id.
 *
 * Consistent ids the cartographic engine relies on across every industry:
 *   - `show_what`         → drives the map TYPE (locations vs values vs coverage…)
 *   - `geographic_scope`  → drives the geographic LEVEL / projection
 *   - `output_use`        → drives page size hints
 * The first question is always the subject/feature type (industry-specific id).
 */

export type QuestionInput = "select" | "radio" | "multi";

export interface QuestionOption {
  value: string;
  label: string;
}

export interface Question {
  id: string;
  label: string;
  help?: string;
  input: QuestionInput;
  options: QuestionOption[];
}

export interface Industry {
  id: string;
  name: string;
  blurb: string;
  custom?: boolean;
  questions: Question[];
}

// ─── Reusable option sets ────────────────────────────────────
const OUTPUT_USE: QuestionOption[] = [
  { value: "annual_report", label: "Printed annual / programme report" },
  { value: "proposal", label: "Grant or funding proposal" },
  { value: "presentation", label: "Presentation (slides)" },
  { value: "poster", label: "Poster or wall display" },
  { value: "web", label: "Website or digital publication" },
];

const SCOPE_STD: QuestionOption[] = [
  { value: "national", label: "National overview" },
  { value: "province", label: "Province / state level" },
  { value: "district", label: "District / county level" },
  { value: "local", label: "Ward / local area level" },
  { value: "city", label: "City / urban area" },
];

const SCOPE_INTL: QuestionOption[] = [
  { value: "global", label: "Global / multi-country" },
  { value: "national", label: "Single country — national" },
  { value: "subnational", label: "Sub-national / regional" },
  { value: "district", label: "District / community level" },
];

const scopeQuestion = (options = SCOPE_STD): Question => ({
  id: "geographic_scope",
  label: "What geographic level?",
  input: "select",
  options,
});

const audienceQuestion = (options: QuestionOption[]): Question => ({
  id: "audience",
  label: "Who will use this map?",
  input: "select",
  options,
});

const outputQuestion = (): Question => ({
  id: "output_use",
  label: "Where will this map be used?",
  input: "select",
  options: OUTPUT_USE,
});

// ─── Industries ──────────────────────────────────────────────
export const INDUSTRIES: Industry[] = [
  {
    id: "healthcare",
    name: "Healthcare & Medical Services",
    blurb: "Clinics, hospitals, coverage, patient volumes, disease burden.",
    questions: [
      {
        id: "facility_type",
        label: "What type of facilities are you mapping?",
        input: "select",
        options: [
          { value: "clinics", label: "Primary clinics / health posts" },
          { value: "hospitals", label: "Hospitals (district, provincial, national)" },
          { value: "pharmacies", label: "Pharmacies & drug dispensaries" },
          { value: "specialist", label: "Specialist centres (eye, dental, maternal)" },
          { value: "chw", label: "Community health workers (CHW) coverage" },
          { value: "mixed", label: "Mixed / multiple facility types" },
        ],
      },
      {
        id: "show_what",
        label: "What do you want the map to show?",
        input: "select",
        options: [
          { value: "locations", label: "Facility locations (where they are)" },
          { value: "catchment", label: "Catchment / service coverage areas" },
          { value: "gaps", label: "Coverage gaps (areas without service)" },
          { value: "volume", label: "Patient volume or utilisation rates" },
          { value: "prevalence", label: "Disease prevalence or burden" },
          { value: "resources", label: "Resource distribution (beds, staff, equipment)" },
        ],
      },
      scopeQuestion(),
      audienceQuestion([
        { value: "government", label: "Government / Ministry of Health" },
        { value: "donors", label: "International donors / funders" },
        { value: "internal", label: "Internal staff / operations" },
        { value: "community", label: "Community / public information" },
        { value: "academic", label: "Academic / research publication" },
      ]),
      outputQuestion(),
    ],
  },

  {
    id: "ngo",
    name: "NGO & International Development",
    blurb: "Project sites, coverage, beneficiaries, funding, impact.",
    questions: [
      {
        id: "project_sector",
        label: "What sector does your project cover?",
        input: "select",
        options: [
          { value: "wash", label: "Water, sanitation & hygiene (WASH)" },
          { value: "food", label: "Food security & nutrition" },
          { value: "education", label: "Education & youth" },
          { value: "livelihoods", label: "Livelihoods & economic empowerment" },
          { value: "humanitarian", label: "Disaster response & humanitarian aid" },
          { value: "protection", label: "Gender & protection" },
          { value: "multi", label: "Multi-sector / integrated" },
        ],
      },
      {
        id: "show_what",
        label: "What should the map communicate?",
        input: "select",
        options: [
          { value: "locations", label: "Project site locations" },
          { value: "coverage", label: "Geographic coverage / reach" },
          { value: "beneficiaries", label: "Beneficiary distribution" },
          { value: "funding", label: "Funding allocation by area" },
          { value: "impact", label: "Before vs. after (impact comparison)" },
          { value: "partners", label: "Partner / implementing area boundaries" },
        ],
      },
      scopeQuestion(SCOPE_INTL),
      audienceQuestion([
        { value: "institutional", label: "Institutional donors (UN, World Bank, EU, USAID)" },
        { value: "foundation", label: "Private / foundation donors" },
        { value: "government", label: "Government partners" },
        { value: "community", label: "Community stakeholders" },
        { value: "board", label: "Internal / board reporting" },
      ]),
      {
        id: "output_use",
        label: "Output destination?",
        input: "select",
        options: [
          { value: "donor_report", label: "Donor report (print)" },
          { value: "proposal", label: "Proposal document" },
          { value: "sitrep", label: "Situation report (SitRep)" },
          { value: "web", label: "Website / social media" },
          { value: "presentation", label: "Presentation" },
        ],
      },
    ],
  },

  {
    id: "sports",
    name: "Sports & Recreation",
    blurb: "Venues, clubs, participation, tournaments, development zones.",
    questions: [
      {
        id: "sport_type",
        label: "Sport or activity?",
        input: "select",
        options: [
          { value: "football", label: "Football / soccer" },
          { value: "basketball", label: "Basketball / netball" },
          { value: "athletics", label: "Athletics & running" },
          { value: "swimming", label: "Swimming & water sports" },
          { value: "multi", label: "Multi-sport / general recreation" },
          { value: "cycling", label: "Cycling & trails" },
          { value: "field", label: "Rugby / cricket / field sports" },
        ],
      },
      {
        id: "show_what",
        label: "What to show?",
        input: "select",
        options: [
          { value: "locations", label: "Facility / venue locations" },
          { value: "clubs", label: "Club or team distribution" },
          { value: "participation", label: "Participation rates by area" },
          { value: "events", label: "Tournament / event venues" },
          { value: "catchment", label: "Catchment / recruitment zones" },
          { value: "gaps", label: "Development / underserved areas" },
        ],
      },
      scopeQuestion([
        { value: "national", label: "National federation / association" },
        { value: "province", label: "Regional / provincial league" },
        { value: "city", label: "City / metro area" },
        { value: "local", label: "Club / grassroots level" },
      ]),
      audienceQuestion([
        { value: "federation", label: "National sports federation" },
        { value: "sponsors", label: "Sponsors & commercial partners" },
        { value: "government", label: "Government / sports ministry" },
        { value: "media", label: "Media / public" },
        { value: "coaches", label: "Coaches & clubs" },
      ]),
      {
        id: "output_use",
        label: "Output format?",
        input: "select",
        options: [
          { value: "annual_report", label: "Print publication / magazine" },
          { value: "proposal", label: "Sponsorship proposal" },
          { value: "web", label: "Social media graphic" },
          { value: "presentation", label: "Presentation / pitch deck" },
          { value: "report", label: "Annual report" },
        ],
      },
    ],
  },

  {
    id: "arts",
    name: "Arts & Culture",
    blurb: "Galleries, venues, heritage, festivals, cultural districts.",
    questions: [
      {
        id: "cultural_type",
        label: "Type of arts or culture?",
        input: "select",
        options: [
          { value: "visual", label: "Visual arts (galleries, studios, exhibitions)" },
          { value: "performing", label: "Performing arts (theatres, concert halls)" },
          { value: "museums", label: "Museums & heritage sites" },
          { value: "street", label: "Street art & public installations" },
          { value: "film", label: "Film & media production" },
          { value: "festivals", label: "Festivals & cultural events" },
          { value: "mixed", label: "Mixed / arts district overview" },
        ],
      },
      {
        id: "show_what",
        label: "What to map?",
        input: "select",
        options: [
          { value: "locations", label: "Venue / institution locations" },
          { value: "districts", label: "Cultural district boundaries" },
          { value: "artists", label: "Artist or practitioner distribution" },
          { value: "events", label: "Event or festival coverage" },
          { value: "heritage", label: "Cultural heritage / historic sites" },
          { value: "access", label: "Access / proximity to communities" },
        ],
      },
      {
        id: "aesthetic_style",
        label: "Visual aesthetic?",
        input: "select",
        options: [
          { value: "contemporary", label: "Contemporary & minimal (clean, white space)" },
          { value: "editorial", label: "Editorial & classic (newspaper / magazine feel)" },
          { value: "bold", label: "Bold & expressive (vibrant, artistic)" },
          { value: "neutral", label: "Neutral & professional (council / grant report)" },
        ],
      },
      audienceQuestion([
        { value: "arts_council", label: "Arts council / grant funders" },
        { value: "public", label: "General public / tourists" },
        { value: "artists", label: "Artists & practitioners" },
        { value: "government", label: "Local government / planning" },
        { value: "media", label: "Media & press" },
      ]),
      {
        id: "output_use",
        label: "Output destination?",
        input: "select",
        options: [
          { value: "proposal", label: "Grant application" },
          { value: "catalogue", label: "Programme or catalogue" },
          { value: "wayfinding", label: "Wayfinding / visitor guide" },
          { value: "web", label: "Social media" },
          { value: "poster", label: "Exhibition or gallery display" },
        ],
      },
    ],
  },

  {
    id: "education",
    name: "Education & Schools",
    blurb: "Schools, enrolment, catchments, access gaps, performance.",
    questions: [
      {
        id: "institution_type",
        label: "Institution type?",
        input: "select",
        options: [
          { value: "primary", label: "Primary / elementary schools" },
          { value: "secondary", label: "Secondary / high schools" },
          { value: "tertiary", label: "Universities & colleges" },
          { value: "vocational", label: "Vocational & technical training" },
          { value: "early", label: "Early childhood / pre-school" },
          { value: "mixed", label: "Mixed / all levels" },
        ],
      },
      {
        id: "show_what",
        label: "What to show?",
        input: "select",
        options: [
          { value: "locations", label: "School / campus locations" },
          { value: "enrolment", label: "Enrolment or pupil numbers by area" },
          { value: "catchment", label: "Catchment / zoning boundaries" },
          { value: "gaps", label: "Access gaps (areas without schools)" },
          { value: "performance", label: "Academic performance by region" },
          { value: "infrastructure", label: "Infrastructure quality" },
        ],
      },
      scopeQuestion(),
      audienceQuestion([
        { value: "government", label: "Ministry of Education / government" },
        { value: "donors", label: "International donors / NGOs" },
        { value: "community", label: "Parents & communities" },
        { value: "academic", label: "Academic / research" },
        { value: "media", label: "Media" },
      ]),
      {
        id: "output_use",
        label: "Output use?",
        input: "select",
        options: [
          { value: "policy", label: "Policy report / white paper" },
          { value: "proposal", label: "Grant / funding proposal" },
          { value: "prospectus", label: "School prospectus" },
          { value: "web", label: "Press release / media" },
          { value: "presentation", label: "Presentation / dashboard" },
        ],
      },
    ],
  },

  {
    id: "government",
    name: "Government & Municipal Services",
    blurb: "Infrastructure, boundaries, services, zoning, public safety.",
    questions: [
      {
        id: "service_type",
        label: "What service or function?",
        input: "select",
        options: [
          { value: "infrastructure", label: "Public infrastructure (roads, bridges, utilities)" },
          { value: "boundaries", label: "Administrative boundaries / districts" },
          { value: "social", label: "Social services distribution" },
          { value: "electoral", label: "Electoral / voting districts" },
          { value: "landuse", label: "Land use & zoning" },
          { value: "safety", label: "Public safety / law enforcement" },
        ],
      },
      {
        id: "show_what",
        label: "What to communicate?",
        input: "select",
        options: [
          { value: "coverage", label: "Service coverage / reach" },
          { value: "inventory", label: "Asset or facility inventory" },
          { value: "population", label: "Population served by area" },
          { value: "gaps", label: "Gaps in service delivery" },
          { value: "projects", label: "Development project locations" },
          { value: "statistics", label: "Statistical data by district" },
        ],
      },
      scopeQuestion(),
      audienceQuestion([
        { value: "officials", label: "Senior government officials" },
        { value: "legislature", label: "Parliament / legislature" },
        { value: "public", label: "Citizens / public" },
        { value: "partners", label: "Development partners" },
        { value: "media", label: "Media" },
      ]),
      outputQuestion(),
    ],
  },

  {
    id: "environment",
    name: "Environment & Conservation",
    blurb: "Protected areas, habitats, deforestation, biodiversity, threats.",
    questions: [
      {
        id: "subject",
        label: "What are you mapping?",
        input: "select",
        options: [
          { value: "protected", label: "Protected areas / national parks" },
          { value: "habitats", label: "Habitats & ecosystems" },
          { value: "forest", label: "Forest cover / deforestation" },
          { value: "water", label: "Watersheds & water bodies" },
          { value: "species", label: "Species & biodiversity" },
          { value: "threats", label: "Threats (fire, pollution, encroachment)" },
        ],
      },
      {
        id: "show_what",
        label: "What should the map show?",
        input: "select",
        options: [
          { value: "extent", label: "Extent / boundaries of areas" },
          { value: "change", label: "Change over time (loss / gain)" },
          { value: "density", label: "Density or abundance by area" },
          { value: "hotspots", label: "Hotspots / priority zones" },
          { value: "locations", label: "Monitoring or project sites" },
          { value: "risk", label: "Risk or pressure by area" },
        ],
      },
      scopeQuestion(SCOPE_INTL),
      audienceQuestion([
        { value: "donors", label: "Conservation funders / donors" },
        { value: "government", label: "Government / environment ministry" },
        { value: "scientific", label: "Scientific / research community" },
        { value: "public", label: "Public awareness" },
        { value: "partners", label: "NGO / partner organisations" },
      ]),
      outputQuestion(),
    ],
  },

  {
    id: "agriculture",
    name: "Agriculture & Food Systems",
    blurb: "Farms, crops, yields, markets, food security.",
    questions: [
      {
        id: "subject",
        label: "What are you mapping?",
        input: "select",
        options: [
          { value: "farms", label: "Farms & smallholder plots" },
          { value: "crops", label: "Crop types / cropping areas" },
          { value: "livestock", label: "Livestock distribution" },
          { value: "markets", label: "Markets & aggregation points" },
          { value: "irrigation", label: "Irrigation & water access" },
          { value: "cooperatives", label: "Cooperatives / out-grower schemes" },
        ],
      },
      {
        id: "show_what",
        label: "What should the map show?",
        input: "select",
        options: [
          { value: "locations", label: "Locations (where they are)" },
          { value: "yield", label: "Yields or production by area" },
          { value: "suitability", label: "Suitability / potential" },
          { value: "foodsecurity", label: "Food security / risk classification" },
          { value: "access", label: "Access to markets / inputs" },
          { value: "coverage", label: "Programme coverage" },
        ],
      },
      scopeQuestion(),
      audienceQuestion([
        { value: "government", label: "Government / agriculture ministry" },
        { value: "donors", label: "Donors / development partners" },
        { value: "agribusiness", label: "Agribusiness / buyers" },
        { value: "cooperatives", label: "Farmers & cooperatives" },
        { value: "research", label: "Research / academia" },
      ]),
      outputQuestion(),
    ],
  },

  {
    id: "realestate",
    name: "Real Estate & Urban Planning",
    blurb: "Developments, land use, prices, density, amenities.",
    questions: [
      {
        id: "subject",
        label: "What are you mapping?",
        input: "select",
        options: [
          { value: "developments", label: "Developments / properties" },
          { value: "landuse", label: "Land use & zoning" },
          { value: "prices", label: "Prices / values by area" },
          { value: "density", label: "Population or housing density" },
          { value: "amenities", label: "Amenities & services" },
          { value: "transport", label: "Transport & connectivity" },
        ],
      },
      {
        id: "show_what",
        label: "What should the map show?",
        input: "select",
        options: [
          { value: "locations", label: "Locations of sites / properties" },
          { value: "values", label: "Values / prices by area" },
          { value: "density", label: "Density by area" },
          { value: "zones", label: "Zones / planning boundaries" },
          { value: "access", label: "Access / proximity to amenities" },
          { value: "growth", label: "Growth / change over time" },
        ],
      },
      scopeQuestion([
        { value: "city", label: "City / metro area" },
        { value: "district", label: "District / suburb level" },
        { value: "neighbourhood", label: "Neighbourhood / block level" },
        { value: "national", label: "National overview" },
      ]),
      audienceQuestion([
        { value: "investors", label: "Investors / developers" },
        { value: "buyers", label: "Buyers / clients" },
        { value: "government", label: "Planning authority / council" },
        { value: "internal", label: "Internal / brokerage" },
        { value: "public", label: "Public / marketing" },
      ]),
      {
        id: "output_use",
        label: "Output use?",
        input: "select",
        options: [
          { value: "proposal", label: "Investment / pitch document" },
          { value: "brochure", label: "Marketing brochure" },
          { value: "report", label: "Planning report" },
          { value: "presentation", label: "Presentation" },
          { value: "web", label: "Website / listing" },
        ],
      },
    ],
  },

  {
    id: "tourism",
    name: "Tourism & Hospitality",
    blurb: "Attractions, accommodation, routes, visitor flows.",
    questions: [
      {
        id: "subject",
        label: "What are you mapping?",
        input: "select",
        options: [
          { value: "attractions", label: "Attractions & sights" },
          { value: "accommodation", label: "Hotels & accommodation" },
          { value: "routes", label: "Routes & itineraries" },
          { value: "activities", label: "Activities & experiences" },
          { value: "regions", label: "Tourism regions / circuits" },
          { value: "mixed", label: "Mixed / destination overview" },
        ],
      },
      {
        id: "show_what",
        label: "What should the map show?",
        input: "select",
        options: [
          { value: "locations", label: "Locations of points of interest" },
          { value: "routes", label: "Routes / suggested itineraries" },
          { value: "volume", label: "Visitor volumes by area" },
          { value: "regions", label: "Regions / zones" },
          { value: "access", label: "Access & connectivity" },
          { value: "density", label: "Density of offerings" },
        ],
      },
      scopeQuestion(SCOPE_INTL),
      audienceQuestion([
        { value: "tourists", label: "Tourists / visitors" },
        { value: "operators", label: "Tour operators / trade" },
        { value: "government", label: "Tourism board / government" },
        { value: "investors", label: "Investors / partners" },
        { value: "media", label: "Media / marketing" },
      ]),
      {
        id: "output_use",
        label: "Output use?",
        input: "select",
        options: [
          { value: "guide", label: "Visitor guide / brochure" },
          { value: "web", label: "Website / social media" },
          { value: "presentation", label: "Trade presentation" },
          { value: "poster", label: "Poster / wall map" },
          { value: "report", label: "Strategy / annual report" },
        ],
      },
    ],
  },

  {
    id: "public_health",
    name: "Public Health & Epidemiology",
    blurb: "Cases, incidence, surveillance, risk, interventions.",
    questions: [
      {
        id: "subject",
        label: "What are you mapping?",
        input: "select",
        options: [
          { value: "cases", label: "Cases / outbreaks" },
          { value: "incidence", label: "Incidence / prevalence rates" },
          { value: "surveillance", label: "Surveillance sites" },
          { value: "vaccination", label: "Vaccination / intervention coverage" },
          { value: "risk", label: "Risk factors / determinants" },
          { value: "mortality", label: "Mortality / burden" },
        ],
      },
      {
        id: "show_what",
        label: "What should the map show?",
        input: "select",
        options: [
          { value: "rates", label: "Rates by area (incidence / prevalence)" },
          { value: "counts", label: "Case counts by location" },
          { value: "hotspots", label: "Hotspots / clusters" },
          { value: "coverage", label: "Intervention coverage / gaps" },
          { value: "trend", label: "Change over time" },
          { value: "risk", label: "Risk classification" },
        ],
      },
      scopeQuestion(),
      audienceQuestion([
        { value: "government", label: "Ministry of Health / public health agency" },
        { value: "donors", label: "Donors / global health funders" },
        { value: "academic", label: "Academic / journal publication" },
        { value: "responders", label: "Field responders / operations" },
        { value: "public", label: "Public communication" },
      ]),
      {
        id: "output_use",
        label: "Output use?",
        input: "select",
        options: [
          { value: "report", label: "Surveillance / situation report" },
          { value: "academic", label: "Academic publication" },
          { value: "presentation", label: "Briefing / presentation" },
          { value: "proposal", label: "Grant proposal" },
          { value: "web", label: "Dashboard / web" },
        ],
      },
    ],
  },

  {
    id: "emergency",
    name: "Emergency Services & Disaster Response",
    blurb: "Incidents, response, damage, evacuation, resources.",
    questions: [
      {
        id: "subject",
        label: "What are you mapping?",
        input: "select",
        options: [
          { value: "incidents", label: "Incidents / events" },
          { value: "damage", label: "Damage / affected areas" },
          { value: "resources", label: "Response resources & assets" },
          { value: "shelters", label: "Shelters / evacuation centres" },
          { value: "hazards", label: "Hazard / risk zones" },
          { value: "access", label: "Access & logistics routes" },
        ],
      },
      {
        id: "show_what",
        label: "What should the map show?",
        input: "select",
        options: [
          { value: "locations", label: "Locations of incidents / assets" },
          { value: "severity", label: "Severity / impact by area" },
          { value: "affected", label: "Affected population by area" },
          { value: "coverage", label: "Response coverage / gaps" },
          { value: "risk", label: "Risk / hazard zones" },
          { value: "routes", label: "Access routes & logistics" },
        ],
      },
      scopeQuestion(SCOPE_INTL),
      audienceQuestion([
        { value: "responders", label: "Responders / coordination (OCHA, clusters)" },
        { value: "government", label: "Government / civil protection" },
        { value: "donors", label: "Donors / humanitarian funders" },
        { value: "public", label: "Affected public" },
        { value: "media", label: "Media" },
      ]),
      {
        id: "output_use",
        label: "Output use?",
        input: "select",
        options: [
          { value: "sitrep", label: "Situation report (SitRep)" },
          { value: "briefing", label: "Operational briefing" },
          { value: "proposal", label: "Appeal / funding request" },
          { value: "web", label: "Web / social media" },
          { value: "poster", label: "Wall / operations room display" },
        ],
      },
    ],
  },

  {
    id: "mining",
    name: "Mining & Extractive Industries",
    blurb: "Concessions, sites, production, logistics, impact.",
    questions: [
      {
        id: "subject",
        label: "What are you mapping?",
        input: "select",
        options: [
          { value: "concessions", label: "Licences / concession blocks" },
          { value: "sites", label: "Mine / extraction sites" },
          { value: "exploration", label: "Exploration targets" },
          { value: "infrastructure", label: "Processing & infrastructure" },
          { value: "logistics", label: "Transport & export logistics" },
          { value: "community", label: "Community / impact areas" },
        ],
      },
      {
        id: "show_what",
        label: "What should the map show?",
        input: "select",
        options: [
          { value: "locations", label: "Locations of sites / assets" },
          { value: "boundaries", label: "Concession / licence boundaries" },
          { value: "production", label: "Production / output by site" },
          { value: "potential", label: "Resource potential / grade" },
          { value: "impact", label: "Environmental / social impact zones" },
          { value: "logistics", label: "Logistics & routes" },
        ],
      },
      scopeQuestion(SCOPE_INTL),
      audienceQuestion([
        { value: "investors", label: "Investors / shareholders" },
        { value: "government", label: "Government / regulators" },
        { value: "internal", label: "Internal / operations" },
        { value: "community", label: "Communities / stakeholders" },
        { value: "partners", label: "Partners / contractors" },
      ]),
      {
        id: "output_use",
        label: "Output use?",
        input: "select",
        options: [
          { value: "report", label: "Technical / annual report" },
          { value: "proposal", label: "Investor / financing document" },
          { value: "presentation", label: "Presentation" },
          { value: "compliance", label: "Regulatory / compliance filing" },
          { value: "poster", label: "Poster / wall display" },
        ],
      },
    ],
  },

  {
    id: "transport",
    name: "Transportation & Logistics",
    blurb: "Networks, routes, hubs, flows, coverage.",
    questions: [
      {
        id: "subject",
        label: "What are you mapping?",
        input: "select",
        options: [
          { value: "network", label: "Road / rail network" },
          { value: "routes", label: "Routes & corridors" },
          { value: "hubs", label: "Hubs, depots & terminals" },
          { value: "stops", label: "Stops / stations" },
          { value: "fleet", label: "Fleet / delivery coverage" },
          { value: "ports", label: "Ports & airports" },
        ],
      },
      {
        id: "show_what",
        label: "What should the map show?",
        input: "select",
        options: [
          { value: "network", label: "Network / routes" },
          { value: "locations", label: "Locations of hubs / stops" },
          { value: "flows", label: "Flows / volumes" },
          { value: "coverage", label: "Coverage / service areas" },
          { value: "performance", label: "Performance by area / route" },
          { value: "gaps", label: "Gaps / underserved areas" },
        ],
      },
      scopeQuestion(SCOPE_INTL),
      audienceQuestion([
        { value: "operations", label: "Operations / internal" },
        { value: "government", label: "Government / transport authority" },
        { value: "investors", label: "Investors / partners" },
        { value: "customers", label: "Customers / public" },
        { value: "planners", label: "Planners / consultants" },
      ]),
      outputQuestion(),
    ],
  },

  {
    id: "energy",
    name: "Energy & Utilities",
    blurb: "Generation, grids, access, demand, outages.",
    questions: [
      {
        id: "subject",
        label: "What are you mapping?",
        input: "select",
        options: [
          { value: "generation", label: "Generation (plants, solar, wind, hydro)" },
          { value: "grid", label: "Transmission & distribution grid" },
          { value: "access", label: "Electrification / energy access" },
          { value: "demand", label: "Demand / consumption" },
          { value: "assets", label: "Assets & substations" },
          { value: "outages", label: "Outages / reliability" },
        ],
      },
      {
        id: "show_what",
        label: "What should the map show?",
        input: "select",
        options: [
          { value: "locations", label: "Locations of assets" },
          { value: "network", label: "Network / lines" },
          { value: "access", label: "Access rates by area" },
          { value: "demand", label: "Demand / consumption by area" },
          { value: "potential", label: "Resource potential (solar / wind)" },
          { value: "reliability", label: "Reliability / outages by area" },
        ],
      },
      scopeQuestion(),
      audienceQuestion([
        { value: "government", label: "Government / energy ministry" },
        { value: "investors", label: "Investors / financiers" },
        { value: "operations", label: "Utility / operations" },
        { value: "donors", label: "Donors / development partners" },
        { value: "public", label: "Public / customers" },
      ]),
      outputQuestion(),
    ],
  },

  {
    id: "journalism",
    name: "Journalism & Data Media",
    blurb: "Stories, events, results, comparisons for publication.",
    questions: [
      {
        id: "subject",
        label: "What is the story about?",
        input: "select",
        options: [
          { value: "events", label: "Events / incidents" },
          { value: "results", label: "Election / poll results" },
          { value: "statistics", label: "Statistics / indicators" },
          { value: "comparison", label: "Comparison between areas" },
          { value: "locations", label: "Locations relevant to a story" },
          { value: "movement", label: "Movement / flows" },
        ],
      },
      {
        id: "show_what",
        label: "What should the map show?",
        input: "select",
        options: [
          { value: "values", label: "A value by area (choropleth)" },
          { value: "locations", label: "Where things happened" },
          { value: "counts", label: "Counts / magnitude by place" },
          { value: "categories", label: "Categories by area (e.g. who won)" },
          { value: "change", label: "Change / swing" },
          { value: "flows", label: "Flows between places" },
        ],
      },
      scopeQuestion(SCOPE_INTL),
      audienceQuestion([
        { value: "readers", label: "General readers" },
        { value: "print", label: "Print edition" },
        { value: "digital", label: "Digital / interactive" },
        { value: "broadcast", label: "Broadcast / TV" },
        { value: "social", label: "Social media" },
      ]),
      {
        id: "output_use",
        label: "Output use?",
        input: "select",
        options: [
          { value: "web", label: "Online article" },
          { value: "print", label: "Print / newspaper" },
          { value: "social", label: "Social media graphic" },
          { value: "presentation", label: "Presentation" },
          { value: "poster", label: "Infographic / poster" },
        ],
      },
    ],
  },

  {
    id: "research",
    name: "Research & Academia",
    blurb: "Study sites, sampling, results, spatial analysis.",
    questions: [
      {
        id: "subject",
        label: "What are you mapping?",
        input: "select",
        options: [
          { value: "sites", label: "Study / field sites" },
          { value: "samples", label: "Sampling points" },
          { value: "results", label: "Results / measurements" },
          { value: "regions", label: "Study regions / units" },
          { value: "distribution", label: "Distribution of a phenomenon" },
          { value: "model", label: "Model / predicted surface" },
        ],
      },
      {
        id: "show_what",
        label: "What should the map show?",
        input: "select",
        options: [
          { value: "locations", label: "Locations of sites / samples" },
          { value: "values", label: "Measured values by area" },
          { value: "density", label: "Density / abundance" },
          { value: "classification", label: "Classification by area" },
          { value: "comparison", label: "Comparison between groups" },
          { value: "change", label: "Change over time" },
        ],
      },
      scopeQuestion(SCOPE_INTL),
      audienceQuestion([
        { value: "journal", label: "Journal / publication" },
        { value: "conference", label: "Conference / poster" },
        { value: "funders", label: "Funders / grant body" },
        { value: "collaborators", label: "Collaborators / internal" },
        { value: "public", label: "Public / outreach" },
      ]),
      {
        id: "output_use",
        label: "Output use?",
        input: "select",
        options: [
          { value: "academic", label: "Journal figure" },
          { value: "poster", label: "Conference poster" },
          { value: "thesis", label: "Thesis / dissertation" },
          { value: "proposal", label: "Grant proposal" },
          { value: "presentation", label: "Presentation" },
        ],
      },
    ],
  },

  {
    id: "faith",
    name: "Faith & Community Organizations",
    blurb: "Congregations, programmes, outreach, membership.",
    questions: [
      {
        id: "subject",
        label: "What are you mapping?",
        input: "select",
        options: [
          { value: "congregations", label: "Congregations / places of worship" },
          { value: "programmes", label: "Programmes & ministries" },
          { value: "outreach", label: "Outreach / mission areas" },
          { value: "members", label: "Membership distribution" },
          { value: "partners", label: "Partner organisations" },
          { value: "facilities", label: "Facilities & services" },
        ],
      },
      {
        id: "show_what",
        label: "What should the map show?",
        input: "select",
        options: [
          { value: "locations", label: "Locations" },
          { value: "membership", label: "Membership / attendance by area" },
          { value: "coverage", label: "Coverage / reach" },
          { value: "growth", label: "Growth / change" },
          { value: "gaps", label: "Gaps / opportunity areas" },
          { value: "programmes", label: "Programme distribution" },
        ],
      },
      scopeQuestion(),
      audienceQuestion([
        { value: "leadership", label: "Leadership / board" },
        { value: "members", label: "Members / congregation" },
        { value: "donors", label: "Donors / supporters" },
        { value: "partners", label: "Partners" },
        { value: "public", label: "Public" },
      ]),
      outputQuestion(),
    ],
  },

  {
    id: "social_services",
    name: "Social Services & Welfare",
    blurb: "Services, caseloads, need, coverage, vulnerability.",
    questions: [
      {
        id: "subject",
        label: "What are you mapping?",
        input: "select",
        options: [
          { value: "services", label: "Service / office locations" },
          { value: "caseload", label: "Caseload / clients" },
          { value: "need", label: "Need / vulnerability" },
          { value: "programmes", label: "Programme coverage" },
          { value: "benefits", label: "Benefit / grant distribution" },
          { value: "partners", label: "Partner / referral network" },
        ],
      },
      {
        id: "show_what",
        label: "What should the map show?",
        input: "select",
        options: [
          { value: "locations", label: "Locations of services" },
          { value: "caseload", label: "Caseload / clients by area" },
          { value: "need", label: "Need / vulnerability by area" },
          { value: "coverage", label: "Coverage / gaps" },
          { value: "access", label: "Access / proximity" },
          { value: "outcomes", label: "Outcomes by area" },
        ],
      },
      scopeQuestion(),
      audienceQuestion([
        { value: "government", label: "Government / department" },
        { value: "funders", label: "Funders / commissioners" },
        { value: "internal", label: "Internal / operations" },
        { value: "partners", label: "Partners / referral agencies" },
        { value: "public", label: "Public / community" },
      ]),
      outputQuestion(),
    ],
  },

  {
    id: "finance",
    name: "Finance & Insurance",
    blurb: "Branches, customers, risk, exposure, markets.",
    questions: [
      {
        id: "subject",
        label: "What are you mapping?",
        input: "select",
        options: [
          { value: "branches", label: "Branches / agents / ATMs" },
          { value: "customers", label: "Customers / accounts" },
          { value: "risk", label: "Risk / exposure" },
          { value: "claims", label: "Claims / losses" },
          { value: "market", label: "Market / opportunity" },
          { value: "performance", label: "Performance by area" },
        ],
      },
      {
        id: "show_what",
        label: "What should the map show?",
        input: "select",
        options: [
          { value: "locations", label: "Locations of branches / agents" },
          { value: "values", label: "Values / volumes by area" },
          { value: "risk", label: "Risk / exposure by area" },
          { value: "penetration", label: "Penetration / market share" },
          { value: "coverage", label: "Coverage / access gaps" },
          { value: "performance", label: "Performance by area" },
        ],
      },
      scopeQuestion(SCOPE_INTL),
      audienceQuestion([
        { value: "executives", label: "Executives / board" },
        { value: "investors", label: "Investors / analysts" },
        { value: "regulators", label: "Regulators" },
        { value: "internal", label: "Internal / strategy" },
        { value: "customers", label: "Customers / marketing" },
      ]),
      {
        id: "output_use",
        label: "Output use?",
        input: "select",
        options: [
          { value: "report", label: "Annual / investor report" },
          { value: "presentation", label: "Board / strategy presentation" },
          { value: "proposal", label: "Proposal / pitch" },
          { value: "compliance", label: "Regulatory filing" },
          { value: "web", label: "Web / marketing" },
        ],
      },
    ],
  },

  {
    id: "construction",
    name: "Construction & Infrastructure",
    blurb: "Projects, sites, progress, assets, networks.",
    questions: [
      {
        id: "subject",
        label: "What are you mapping?",
        input: "select",
        options: [
          { value: "projects", label: "Projects / sites" },
          { value: "assets", label: "Built assets / facilities" },
          { value: "networks", label: "Networks (roads, pipes, cables)" },
          { value: "progress", label: "Progress / status" },
          { value: "pipeline", label: "Pipeline / planned works" },
          { value: "suppliers", label: "Suppliers / contractors" },
        ],
      },
      {
        id: "show_what",
        label: "What should the map show?",
        input: "select",
        options: [
          { value: "locations", label: "Locations of projects / assets" },
          { value: "status", label: "Status / progress by site" },
          { value: "value", label: "Value / size by area" },
          { value: "network", label: "Network / corridors" },
          { value: "coverage", label: "Coverage / distribution" },
          { value: "timeline", label: "Phasing / timeline" },
        ],
      },
      scopeQuestion(SCOPE_INTL),
      audienceQuestion([
        { value: "clients", label: "Clients / owners" },
        { value: "government", label: "Government / authority" },
        { value: "investors", label: "Investors / financiers" },
        { value: "internal", label: "Internal / project teams" },
        { value: "public", label: "Public / stakeholders" },
      ]),
      outputQuestion(),
    ],
  },

  {
    id: "retail",
    name: "Retail & Consumer Business",
    blurb: "Stores, customers, sales, catchments, expansion.",
    questions: [
      {
        id: "subject",
        label: "What are you mapping?",
        input: "select",
        options: [
          { value: "stores", label: "Stores / outlets" },
          { value: "customers", label: "Customers" },
          { value: "sales", label: "Sales / revenue" },
          { value: "catchment", label: "Catchment / trade areas" },
          { value: "competition", label: "Competitors" },
          { value: "expansion", label: "Expansion opportunities" },
        ],
      },
      {
        id: "show_what",
        label: "What should the map show?",
        input: "select",
        options: [
          { value: "locations", label: "Locations of stores / customers" },
          { value: "sales", label: "Sales / revenue by area" },
          { value: "density", label: "Customer density by area" },
          { value: "catchment", label: "Catchment / trade areas" },
          { value: "penetration", label: "Penetration / share" },
          { value: "opportunity", label: "Opportunity / white space" },
        ],
      },
      scopeQuestion([
        { value: "national", label: "National overview" },
        { value: "city", label: "City / metro area" },
        { value: "district", label: "District / suburb" },
        { value: "neighbourhood", label: "Neighbourhood / catchment" },
      ]),
      audienceQuestion([
        { value: "executives", label: "Executives / leadership" },
        { value: "investors", label: "Investors / partners" },
        { value: "operations", label: "Operations / regional managers" },
        { value: "marketing", label: "Marketing" },
        { value: "franchise", label: "Franchisees" },
      ]),
      {
        id: "output_use",
        label: "Output use?",
        input: "select",
        options: [
          { value: "presentation", label: "Strategy presentation" },
          { value: "report", label: "Business report" },
          { value: "proposal", label: "Investment / expansion proposal" },
          { value: "web", label: "Web / marketing" },
          { value: "poster", label: "Poster / display" },
        ],
      },
    ],
  },

  {
    id: "wash",
    name: "Water, Sanitation & Hygiene (WASH)",
    blurb: "Water points, sanitation, access, quality, coverage.",
    questions: [
      {
        id: "subject",
        label: "What are you mapping?",
        input: "select",
        options: [
          { value: "waterpoints", label: "Water points / boreholes / taps" },
          { value: "sanitation", label: "Sanitation facilities / latrines" },
          { value: "networks", label: "Water supply networks" },
          { value: "sources", label: "Water sources / catchments" },
          { value: "quality", label: "Water quality monitoring" },
          { value: "hygiene", label: "Hygiene programmes" },
        ],
      },
      {
        id: "show_what",
        label: "What should the map show?",
        input: "select",
        options: [
          { value: "locations", label: "Locations of facilities" },
          { value: "access", label: "Access rates by area" },
          { value: "functionality", label: "Functionality / status" },
          { value: "coverage", label: "Coverage / gaps" },
          { value: "quality", label: "Water quality by area" },
          { value: "population", label: "Population served" },
        ],
      },
      scopeQuestion(SCOPE_INTL),
      audienceQuestion([
        { value: "donors", label: "Donors / funders" },
        { value: "government", label: "Government / water authority" },
        { value: "internal", label: "Internal / operations" },
        { value: "community", label: "Community / public" },
        { value: "partners", label: "Partners" },
      ]),
      {
        id: "output_use",
        label: "Output use?",
        input: "select",
        options: [
          { value: "donor_report", label: "Donor report" },
          { value: "proposal", label: "Funding proposal" },
          { value: "report", label: "Programme / annual report" },
          { value: "presentation", label: "Presentation" },
          { value: "web", label: "Web / social media" },
        ],
      },
    ],
  },

  {
    id: "custom",
    name: "Custom / Other",
    blurb: "Describe your own use case — we'll map it professionally.",
    custom: true,
    questions: [
      {
        id: "subject",
        label: "What are you mapping?",
        help: "Add detail in the description box on the next step.",
        input: "select",
        options: [
          { value: "locations", label: "Specific locations / points" },
          { value: "areas", label: "Areas / regions" },
          { value: "values", label: "A value / statistic by area" },
          { value: "network", label: "A network / routes" },
          { value: "mixed", label: "A mix of the above" },
        ],
      },
      {
        id: "show_what",
        label: "What should the map show?",
        input: "select",
        options: [
          { value: "locations", label: "Where things are (points)" },
          { value: "values", label: "A value by area (choropleth)" },
          { value: "counts", label: "Counts / magnitude (sized symbols)" },
          { value: "categories", label: "Categories by place" },
          { value: "coverage", label: "Coverage / reach" },
          { value: "density", label: "Density / concentration" },
        ],
      },
      scopeQuestion(SCOPE_INTL),
      audienceQuestion([
        { value: "internal", label: "Internal / team" },
        { value: "external", label: "External / clients" },
        { value: "funders", label: "Funders / investors" },
        { value: "public", label: "Public" },
        { value: "academic", label: "Academic / research" },
      ]),
      outputQuestion(),
    ],
  },
];

export function getIndustry(id: string): Industry | undefined {
  return INDUSTRIES.find((i) => i.id === id);
}
