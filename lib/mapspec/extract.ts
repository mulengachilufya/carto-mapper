import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import mammoth from "mammoth";

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
      name: z.string().describe("The full official name, exactly as the institution or place is officially known. Never shortened or guessed."),
      source: z.enum(["attachment", "prompt", "knowledge"]).describe("Where this place came from: the attachments, the customer's own words, or your general knowledge."),
      confidence: z.enum(["certain", "likely", "unsure"]).describe("How sure you are that this place exists under exactly this name and belongs on this map."),
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

export interface RawExtract {
  places: Place[];
  /** Places listed from general knowledge, waiting for the fact-check. */
  pending: Place[];
  /** Of those, the ones the first pass was certain of (kept if the fact-check can't run). */
  certain: string[];
  checks: string[];
  meta: Omit<Extracted, "places" | "checks">;
}

export type { ExtractResult } from "./extractTable";
export interface Place {
  name: string;
  value?: number;
  category?: string;
  lat?: number;
  lon?: number;
}
export interface Extracted {
  checks?: string[];
  title?: string;
  suggestedMapType?: string;
  valueLabel?: string;
  region?: string;
  places?: Place[];
  summary?: string;
}

const SYSTEM = `You read a customer's request and whatever they attached (reports, articles, spreadsheets exported to PDF, photos of printed tables, screenshots of old maps) and pull out the places and numbers needed to draw ONE map.

- List every place the map should show, with its name as the source writes it (keep official names: "Copperbelt Province", "Nairobi County", "Kano State").
- Values: use only numbers stated in the source for that place, in the source's units; if a place has no number, leave value null. Never estimate or invent data.
- Categories: a short label when the source classifies places (e.g. "Hospital", "Planned", "Phase 2").
- Coordinates: our system already knows countries, provinces, districts and ~7,000 towns by name, so leave lat/lon null for those. Give approximate lat/lon only for small or specific sites it could not find by name (a village, a borehole, a named farm).
- Region: the overall area, the country the places are in, or a region such as "East Africa", or "World".
- suggestedMapType: values per country/region → choropleth; regions to highlight without values → footprint; sites with a count → proportional_symbol; sites by type → categorical_point; just locations → point.
- If the attachments contain no places, return an empty places list and say so in the summary.
- When the customer asks for things that exist in the world ("public universities in Zambia") and attached nothing, you may list them from your knowledge, but only ones you are certain of, each under its full official name (never shorten "X University of Science and Technology" to "X University"). Mark source "knowledge" and be honest about confidence. Leaving a place out is better than inventing or misnaming one.`;

const CHECK_SCHEMA = z.object({
  verdicts: z.array(
    z.object({
      name: z.string().describe("The name as given to you."),
      verdict: z.enum(["correct", "rename", "remove"]),
      correctName: z.string().describe("For rename: the exact official name. Otherwise empty."),
      reason: z.string().describe("One short sentence."),
    }),
  ),
});

const CHECK_SYSTEM = `You are a strict fact-checker for a map. You get a request and a list of places another assistant produced from general knowledge. For each one decide:
- correct: it exists, the name is its exact official name, and it fits the request.
- rename: it exists and fits, but the name is wrong or shortened; give the exact official name.
- remove: you cannot confirm it exists, it does not fit the request (e.g. a private university on a list of public ones), or it is a duplicate.
Be conservative: when in doubt, remove. Never add new places.`;

/** A second, independent pass over places listed from general knowledge: confirm, correct or drop. */
async function factCheck(client: Anthropic, prompt: string, places: Place[]): Promise<{ places: Place[]; checks: string[] }> {
  const resp = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    betas: [FALLBACK_BETA],
    fallbacks: [{ model: FALLBACK_MODEL }],
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: betaZodOutputFormat(CHECK_SCHEMA) },
    system: CHECK_SYSTEM,
    messages: [{ role: "user", content: `Request: ${prompt}\n\nPlaces:\n${places.map((p) => `- ${p.name}`).join("\n")}` }],
  });
  if (resp.stop_reason === "refusal" || !resp.parsed_output) throw new Error("fact-check unavailable");
  const byName = new Map(resp.parsed_output.verdicts.map((v) => [v.name.trim().toLowerCase(), v]));
  const kept: Place[] = [];
  const checks: string[] = [];
  for (const p of places) {
    const v = byName.get(p.name.trim().toLowerCase());
    if (!v || v.verdict === "remove") {
      checks.push(`Left out "${p.name}": ${v?.reason ?? "could not be confirmed."}`);
      continue;
    }
    if (v.verdict === "rename" && v.correctName.trim() && v.correctName.trim() !== p.name) {
      checks.push(`"${p.name}" is officially "${v.correctName.trim()}".`);
      kept.push({ ...p, name: v.correctName.trim() });
    } else kept.push(p);
  }
  return { places: kept, checks };
}

export async function extractMapData(prompt: string, files: ContextFile[]): Promise<RawExtract | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
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
  if (resp.stop_reason === "refusal" || !resp.parsed_output) return null;
  const d = resp.parsed_output;

  // Guardrail: nothing the model "remembers" reaches a map unchecked. Unsure names never do.
  const checks: string[] = [];
  const places: Place[] = [];
  const pending: Place[] = [];
  const certain: string[] = [];
  for (const p of d.places) {
    const place: Place = { name: p.name, value: p.value ?? undefined, category: p.category ?? undefined, lat: p.lat ?? undefined, lon: p.lon ?? undefined };
    if (p.source !== "knowledge") places.push(place);
    else if (p.confidence === "unsure") checks.push(`Left out "${p.name}": not certain it exists under that name.`);
    else {
      pending.push(place);
      if (p.confidence === "certain") certain.push(p.name);
    }
  }
  return {
    places,
    pending,
    certain,
    checks,
    meta: { title: d.title || undefined, region: d.region || undefined, suggestedMapType: d.suggestedMapType, valueLabel: d.valueLabel || undefined, summary: d.summary },
  };
}

/** The fact-check, as its own request so each stays inside the serverless time limit. */
export async function checkPlaces(prompt: string, places: Place[]): Promise<{ places: Place[]; checks: string[] }> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("no key");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 22_000, maxRetries: 0 });
  return factCheck(client, prompt, places);
}
