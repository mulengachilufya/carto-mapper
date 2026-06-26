import Anthropic from "@anthropic-ai/sdk";
import { parseMapSpec, type MapSpec, MAP_TYPES, GEO_LEVELS, CLASSIFICATIONS } from "./schema";
import { PALETTES_BY_KIND } from "@/lib/cartography/palettes";
import { getIndustry } from "@/lib/industries";
import type { GenerateInput } from "./generate";

const MODEL = "claude-sonnet-4-6";

export function hasAnthropic(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export interface RevisionContext {
  previousSpec?: MapSpec;
  revisionRequest?: string;
}

export async function generateMapSpecWithClaude(
  input: GenerateInput,
  revision?: RevisionContext,
): Promise<MapSpec> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(input, revision) }],
  });
  const text = response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n");
  return parseMapSpec(extractJson(text));
}

const SYSTEM_PROMPT = `You are a senior cartographer. You translate a client's brief into a precise map specification (JSON) for a renderer. Every map MUST look like the work of a professional human cartographer — never "AI art".

Hard rules you always follow:
- Equal-area projections for thematic maps; never Web Mercator except at city scale.
- ColorBrewer palettes ONLY. Sequential for one-directional quantitative data, diverging for data around a meaningful midpoint, qualitative for categories. No rainbow, no neon, no gradients-for-decoration.
- Choose a sensible data classification (quantile for skewed data, equal_interval for evenly spread, jenks for clustered).
- Include the right furniture and omit the wrong: world maps get a graticule but NO scale bar and NO north arrow; national/local maps get a scale bar and a discreet north arrow.
- Titles are specific and editorial, not generic. Legends are labelled with the real metric.

Respond with ONLY a single JSON object (no prose, no code fences) matching this shape:
{
  "title": string, "subtitle"?: string, "caption"?: string, "source"?: string,
  "mapType": one of ${JSON.stringify(MAP_TYPES)},
  "geography": { "level": one of ${JSON.stringify(GEO_LEVELS)}, "region"?: string, "projectionHint"?: "equalEarth"|"albers"|"mercator"|"azimuthal" },
  "data": { "nameField"?: string, "valueField"?: string, "categoryField"?: string, "latField"?: string, "lonField"?: string, "valueLabel"?: string, "valueFormat"?: string },
  "symbology": { "palette": ColorBrewer name, "paletteKind": "sequential"|"diverging"|"qualitative", "classes": 3-9, "classification": one of ${JSON.stringify(CLASSIFICATIONS)}, "reverse"?: boolean },
  "furniture": { "title": bool, "legend": bool, "scalebar": bool, "north_arrow": bool, "caption": bool, "source": bool, "graticule": bool },
  "page": { "size": "A4"|"Letter", "orientation": "portrait"|"landscape" }
}

Valid palette names by kind: ${JSON.stringify(PALETTES_BY_KIND)}.
Only reference column names that exist in the provided data. "valueFormat" is a d3-format string (e.g. "," , ".0%", "$,").`;

function buildUserPrompt(input: GenerateInput, revision?: RevisionContext): string {
  const ind = getIndustry(input.industry);
  const answerLines = Object.entries(input.answers ?? {})
    .map(([qid, val]) => {
      const q = ind?.questions.find((x) => x.id === qid);
      const opt = q?.options.find((o) => o.value === val);
      return `- ${q?.label ?? qid}: ${opt?.label ?? val}`;
    })
    .join("\n");

  const table = input.table;
  const dataSummary = table
    ? [
        `Columns: ${table.columns.join(", ")}`,
        `Rows: ${table.rowCount}`,
        input.roles
          ? `Detected roles: ${JSON.stringify(input.roles)}`
          : "",
        `Sample rows: ${JSON.stringify(table.rows.slice(0, 5))}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "No data uploaded.";

  const parts = [
    `Industry: ${input.customIndustry || ind?.name || input.industry}`,
    answerLines ? `Answers:\n${answerLines}` : "",
    input.vibe ? `Client description (free text): "${input.vibe}"` : "",
    `Data:\n${dataSummary}`,
  ];

  if (revision?.revisionRequest && revision.previousSpec) {
    parts.push(
      `\nThis is a REVISION. Previous spec:\n${JSON.stringify(revision.previousSpec)}`,
      `Apply this change, keeping everything else: "${revision.revisionRequest}"`,
    );
  }

  parts.push("\nReturn the JSON map specification now.");
  return parts.filter(Boolean).join("\n\n");
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return {};
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return {};
  }
}
