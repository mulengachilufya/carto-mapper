import Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";
import type { ParsedTable, ColumnRoles, Row } from "@/lib/data/parse";

const MODEL = "claude-sonnet-4-6";

export interface ContextFile {
  name: string;
  mediaType: string;
  dataBase64: string;
}

export interface ExtractResult {
  table: ParsedTable | null;
  roles: ColumnRoles | null;
  mapType?: string;
  title?: string;
  region?: string;
  valueLabel?: string;
  summary?: string;
}

interface Place {
  name: string;
  value?: number;
  category?: string;
  lat?: number;
  lon?: number;
}
interface Extracted {
  title?: string;
  suggestedMapType?: string;
  valueLabel?: string;
  region?: string;
  places?: Place[];
  summary?: string;
}

const SYSTEM = `You read a user's request plus any attached reports, articles, tables, or images, and extract the geographic + statistical information needed to draw ONE map.

Return ONLY a JSON object (no prose, no code fences):
{
  "title": short editorial map title,
  "region": overall area (a country, a continent, or "World") if clear, else omit,
  "suggestedMapType": one of ["choropleth","footprint","proportional_symbol","categorical_point","dot","point"],
  "valueLabel": short label for the metric, if any,
  "places": [ { "name": string, "value"?: number, "category"?: string, "lat"?: number, "lon"?: number } ],
  "summary": one sentence on what you found
}

Rules:
- Include every place you can identify. For SPECIFIC places (cities, towns, sites, districts) include approximate "lat"/"lon" from your knowledge. For whole countries/regions, omit lat/lon and give the country/region name.
- Choose suggestedMapType: values per country/region → "choropleth"; a list of countries to highlight → "footprint"; located sites with a count → "proportional_symbol"; located sites by type → "categorical_point"; just locations → "point".
- Use real numbers from the source for "value" where present; never invent data that isn't there.
- If you find no places, return "places": [].`;

export async function extractMapData(prompt: string, files: ContextFile[]): Promise<ExtractResult> {
  if (!process.env.ANTHROPIC_API_KEY) return { table: null, roles: null };
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const content: Anthropic.Messages.ContentBlockParam[] = [];
  if (prompt?.trim()) content.push({ type: "text", text: `User's request: ${prompt}` });

  for (const f of files) {
    const mt = (f.mediaType || "").toLowerCase();
    const lower = f.name.toLowerCase();
    if (mt === "application/pdf" || lower.endsWith(".pdf")) {
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: f.dataBase64 } });
    } else if (mt.startsWith("image/")) {
      const media = (["image/png", "image/jpeg", "image/gif", "image/webp"].includes(mt) ? mt : "image/png") as
        | "image/png"
        | "image/jpeg"
        | "image/gif"
        | "image/webp";
      content.push({ type: "image", source: { type: "base64", media_type: media, data: f.dataBase64 } });
    } else if (lower.endsWith(".docx") || mt.includes("wordprocessingml")) {
      try {
        const { value } = await mammoth.extractRawText({ buffer: Buffer.from(f.dataBase64, "base64") });
        content.push({ type: "text", text: `Document "${f.name}":\n${value.slice(0, 50000)}` });
      } catch {
        /* ignore unreadable docx */
      }
    } else {
      try {
        content.push({ type: "text", text: `File "${f.name}":\n${Buffer.from(f.dataBase64, "base64").toString("utf8").slice(0, 50000)}` });
      } catch {
        /* ignore */
      }
    }
  }

  content.push({ type: "text", text: "Extract the mappable information now and return ONLY the JSON object." });

  const resp = await client.messages.create({ model: MODEL, max_tokens: 2500, system: SYSTEM, messages: [{ role: "user", content }] });
  const text = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("\n");
  return buildResult(extractJson(text));
}

function buildResult(d: Extracted): ExtractResult {
  const places = (d.places ?? []).filter((p) => p && p.name);
  const meta = { mapType: d.suggestedMapType, title: d.title, region: d.region, valueLabel: d.valueLabel, summary: d.summary };
  if (!places.length) return { table: null, roles: null, ...meta };

  const hasCoords = places.some((p) => typeof p.lat === "number" && typeof p.lon === "number");
  const hasValue = places.some((p) => typeof p.value === "number");
  const hasCat = places.some((p) => p.category);

  const columns = ["name"];
  if (hasCoords) columns.push("latitude", "longitude");
  if (hasValue) columns.push("value");
  if (hasCat) columns.push("category");

  const rows: Row[] = places.map((p) => {
    const r: Row = { name: p.name };
    if (hasCoords) {
      r.latitude = typeof p.lat === "number" ? p.lat : null;
      r.longitude = typeof p.lon === "number" ? p.lon : null;
    }
    if (hasValue) r.value = typeof p.value === "number" ? p.value : null;
    if (hasCat) r.category = p.category ?? null;
    return r;
  });

  const roles: ColumnRoles = { nameField: "name" };
  if (hasCoords) {
    roles.latField = "latitude";
    roles.lonField = "longitude";
  }
  if (hasValue) roles.valueField = "value";
  if (hasCat) roles.categoryField = "category";

  return { table: { columns, rows, rowCount: rows.length }, roles, ...meta };
}

function extractJson(text: string): Extracted {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return {};
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Extracted;
  } catch {
    return {};
  }
}
