import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import mammoth from "mammoth";
import type { ParsedTable, ColumnRoles, Row } from "@/lib/data/parse";

const MODEL = "claude-opus-5";
const FALLBACK_MODEL = "claude-opus-4-8";
const FALLBACK_BETA = "server-side-fallback-2026-06-01";

/** What we read out of the customer's documents, validated before it's used. */
const ExtractedSchema = z.object({
  title: z.string().describe("Short editorial map title; empty string if unclear."),
  region: z.string().describe('Overall area: a country, a region like "East Africa", or "World"; empty string if unclear.'),
  suggestedMapType: z.enum(["choropleth", "footprint", "proportional_symbol", "categorical_point", "dot", "point"]),
  valueLabel: z.string().describe("Label for the metric with its unit; empty string if there is no metric."),
  places: z.array(
    z.object({
      name: z.string(),
      value: z.number().nullable().describe("The number stated in the source for this place, or null. Never invent one."),
      category: z.string().nullable(),
      lat: z.number().nullable().describe("Only for specific small places not easily found by name (villages, sites); else null."),
      lon: z.number().nullable(),
    }),
  ),
  summary: z.string().describe("One sentence on what was found, and anything ambiguous."),
});

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

const SYSTEM = `You read a customer's request and whatever they attached — reports, articles, spreadsheets exported to PDF, photos of printed tables, screenshots of old maps — and pull out the places and numbers needed to draw ONE map.

- List every place the map should show, with its name as the source writes it (keep official names: "Copperbelt Province", "Nairobi County", "Kano State").
- Values: use only numbers stated in the source for that place, in the source's units; if a place has no number, leave value null. Never estimate or invent data.
- Categories: a short label when the source classifies places (e.g. "Hospital", "Planned", "Phase 2").
- Coordinates: our system already knows countries, provinces, districts and ~7,000 towns by name, so leave lat/lon null for those. Give approximate lat/lon only for small or specific sites it could not find by name (a village, a borehole, a named farm).
- Region: the overall area — the country the places are in, a region such as "East Africa", or "World".
- suggestedMapType: values per country/region → choropleth; regions to highlight without values → footprint; sites with a count → proportional_symbol; sites by type → categorical_point; just locations → point.
- If the attachments contain no places, return an empty places list and say so in the summary.`;

export async function extractMapData(prompt: string, files: ContextFile[]): Promise<ExtractResult> {
  if (!process.env.ANTHROPIC_API_KEY) return { table: null, roles: null };
  // Serverless time budget: answer within ~22 s or let the rest of the flow continue without it.
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 22_000, maxRetries: 0 });

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

  content.push({ type: "text", text: "Extract the mappable information now." });

  const resp = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: [{ model: FALLBACK_MODEL }],
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: betaZodOutputFormat(ExtractedSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });
  if (resp.stop_reason === "refusal" || !resp.parsed_output) return { table: null, roles: null };
  const d = resp.parsed_output;
  return buildResult({
    title: d.title || undefined,
    region: d.region || undefined,
    suggestedMapType: d.suggestedMapType,
    valueLabel: d.valueLabel || undefined,
    summary: d.summary,
    places: d.places.map((p) => ({
      name: p.name,
      value: p.value ?? undefined,
      category: p.category ?? undefined,
      lat: p.lat ?? undefined,
      lon: p.lon ?? undefined,
    })),
  });
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
