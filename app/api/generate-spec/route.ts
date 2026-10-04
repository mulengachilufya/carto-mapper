import { NextResponse } from "next/server";
import { applyRevisionHeuristic, type GenerateInput } from "@/lib/mapspec/generate";
import { plan, finalize } from "@/lib/engine";
import { generateMapSpecWithClaude, hasAnthropic } from "@/lib/mapspec/claude";
import { parseMapSpec, MAP_TYPES, MAP_STYLES, GEO_LEVELS, type Decision, type MapSpec } from "@/lib/mapspec/schema";
import { paletteKind, PALETTES_BY_KIND } from "@/lib/cartography/palettes";
import { accountsEnabled, getCurrentUser, getServiceSupabase } from "@/lib/supabase/server";
import { getOwnJob, type JobRow } from "@/lib/jobs";
import { CHANGES_PER_MAP, DAILY_MAP_LIMIT, getUsage, type Usage } from "@/lib/quota";

export const runtime = "nodejs";
// The AI designer answers within ~22 s (then falls back to the rules engine).
export const maxDuration = 30;

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Gate first, before any AI time is spent: signed in, and within today's limit
  // (a new map) or this map's changes (a revision of a map the user owns).
  const accounts = accountsEnabled();
  const user = accounts ? await getCurrentUser() : null;
  if (accounts && !user) {
    return NextResponse.json({ error: "signin", message: "Sign in to make maps." }, { status: 401 });
  }
  const existing: JobRow | null = user && body.jobId ? await getOwnJob(String(body.jobId), user.id) : null;
  let usage: Usage | null = user ? await getUsage(user.id) : null;
  if (existing && existing.revision_count >= CHANGES_PER_MAP) {
    return NextResponse.json(
      { error: "changes", message: `This map has had its ${CHANGES_PER_MAP} changes. Start a new map to keep going.`, usage },
      { status: 429 },
    );
  }
  if (user && !existing && usage && usage.remaining <= 0) {
    return NextResponse.json({ error: "limit", message: limitMessage(usage), usage }, { status: 429 });
  }

  const input: GenerateInput = {
    industry: String(body.industry ?? "custom"),
    customIndustry: body.customIndustry ? String(body.customIndustry) : undefined,
    answers: (body.answers as Record<string, string>) ?? {},
    vibe: body.vibe ? String(body.vibe) : "",
    table: (body.table as GenerateInput["table"]) ?? null,
    roles: (body.roles as GenerateInput["roles"]) ?? {},
    outputOptions: body.outputOptions as Partial<MapSpec["furniture"]> | undefined,
    geography:
      body.geography && (GEO_LEVELS as readonly string[]).includes(String((body.geography as { level?: string }).level))
        ? (body.geography as GenerateInput["geography"])
        : undefined,
  };

  const revision = body.previousSpec
    ? {
        previousSpec: parseMapSpec(body.previousSpec),
        revisionRequest: body.revisionRequest ? String(body.revisionRequest) : undefined,
      }
    : undefined;

  // The engine: read the brief, design by the rulebook, let the AI refine, check everything.
  const userTitle = body.title ? String(body.title).trim() || undefined : undefined;
  const facts = { table: input.table, roles: input.roles, resolved: input.geography, userTitle };
  const run = plan({ ...facts, prompt: input.vibe ?? "" });
  const lockedType =
    !revision && body.mapTypeLocked && typeof body.mapType === "string" && (MAP_TYPES as readonly string[]).includes(body.mapType)
      ? (body.mapType as MapSpec["mapType"])
      : undefined;
  const baseline = lockedType ? parseMapSpec({ ...run.plan.spec, mapType: lockedType }) : run.plan.spec;

  let spec: MapSpec;
  let engine: "claude" | "rules" = "rules";
  let rationale: unknown = null;
  let aiDecisions: Decision[] | undefined;
  try {
    if (hasAnthropic()) {
      const d = await generateMapSpecWithClaude(input, revision, { brief: run.brief, spec: baseline });
      spec = d.spec;
      rationale = d.rationale;
      aiDecisions = d.decisions;
      engine = "claude";
    } else if (revision?.revisionRequest && revision.previousSpec) {
      spec = applyRevisionHeuristic(revision.previousSpec, revision.revisionRequest);
    } else {
      spec = baseline;
    }
  } catch (err) {
    console.error("generate-spec: AI designer unavailable, using the rulebook:", err);
    spec = revision?.revisionRequest && revision.previousSpec ? applyRevisionHeuristic(revision.previousSpec, revision.revisionRequest) : baseline;
    engine = "rules";
  }

  // Branding and the user's own furniture toggles always win.
  if (body.branding && typeof body.branding === "object") spec = parseMapSpec({ ...spec, branding: body.branding });
  if (body.outputOptions) spec = parseMapSpec({ ...spec, furniture: { ...spec.furniture, ...(body.outputOptions as object) } });
  if (lockedType) spec = parseMapSpec({ ...spec, mapType: lockedType });
  // The AI may not drag a first draft back to terrain-and-rivers looks the customer never asked for.
  const OLD_LOOKS = ["atlas", "classic", "minimal"];
  if (!revision && !run.brief.style && OLD_LOOKS.includes(spec.style) && !OLD_LOOKS.includes(baseline.style))
    spec = parseMapSpec({ ...spec, style: baseline.style });

  // Every spec, rulebook's, AI's or revised, passes the engine's checks.
  spec = finalize(spec, run, facts, { aiDecisions, revision: revision?.revisionRequest });
  // Titles: the customer's own title, word for word. Otherwise a plain third-person title
  // ("Public Universities in Zambia, 2026"); anything that reads like a question or a pitch
  // falls back to the rulebook's.
  const titleAsked = Boolean(revision?.revisionRequest && /title|call it|name it|heading/i.test(revision.revisionRequest));
  if (userTitle && !titleAsked) spec = parseMapSpec({ ...spec, title: userTitle });
  else if (!titleAsked && !isPlainTitle(spec.title)) spec = parseMapSpec({ ...spec, title: (revision?.previousSpec.title && isPlainTitle(revision.previousSpec.title) ? revision.previousSpec.title : run.plan.spec.title) });

  // Fonts: what the customer picked, kept through every change.
  const FONT = /^[A-Za-z0-9][A-Za-z0-9 ]{1,40}$/;
  const f = body.fonts as { title?: unknown; text?: unknown } | undefined;
  if (revision) spec = parseMapSpec({ ...spec, typography: revision.previousSpec.typography });
  else if (f && typeof f.title === "string" && typeof f.text === "string" && FONT.test(f.title) && FONT.test(f.text))
    spec = parseMapSpec({ ...spec, typography: { title: f.title, text: f.text } });

  // The look and colours picked in the wizard always win.
  const look = typeof body.look === "string" && (MAP_STYLES as readonly string[]).includes(body.look) ? (body.look as MapSpec["style"]) : undefined;
  const pal =
    typeof body.palette === "string" && (/^#[0-9a-f]{6}$/i.test(body.palette) || PALETTES_BY_KIND.sequential.includes(body.palette)) ? body.palette : undefined;
  if (!revision && (look || pal)) {
    const picked: Decision[] = [];
    if (look) picked.push({ rule: "U1", topic: "Style", choice: look, because: "You picked this look.", by: "brief" });
    const recolour = pal && spec.mapType !== "categorical_point" && paletteKind(spec.symbology.palette) !== "diverging";
    if (recolour) picked.push({ rule: "U2", topic: "Colour", choice: pal!, because: "You picked these colours.", by: "brief" });
    spec = parseMapSpec({
      ...spec,
      style: look ?? spec.style,
      symbology: recolour ? { ...spec.symbology, palette: pal!, paletteKind: "sequential", reverse: false } : spec.symbology,
      decisions: [...(spec.decisions ?? []).filter((d) => !(look && d.topic === "Style") && !(recolour && d.topic === "Colour")), ...picked],
    });
  }
  // Rows implied by the brief itself ("where we work: Kenya, Uganda, Tanzania").
  const rows = !input.table?.rows.length && !revision ? run.plan.rows ?? null : null;

  // Save the map to the user's account. A change to a map they own updates it; anything
  // else is a new map, which counts toward today's limit.
  let jobId: string | null = existing?.id ?? null;
  const sb = getServiceSupabase();
  if (user && sb) {
    try {
      if (existing) {
        await sb
          .from("map_jobs")
          .update({ map_spec: spec, output_options: spec.furniture, revision_count: existing.revision_count + 1 })
          .eq("id", existing.id)
          .eq("user_id", user.id);
      } else {
        const { data } = await sb
          .from("map_jobs")
          .insert({
            user_id: user.id,
            industry: input.industry,
            custom_industry: input.customIndustry ?? null,
            vibe_prompt: input.vibe || null,
            answers: input.answers ?? {},
            uploaded_data: input.table
              ? { columns: input.table.columns, rows: input.table.rows.slice(0, 5000), roles: input.roles }
              : rows
                ? { columns: ["Country"], rows }
                : null,
            map_spec: spec,
            status: "preview",
            output_options: spec.furniture,
          })
          .select("id")
          .single();
        jobId = data?.id ?? null;
        // Two tabs racing past the check above: keep the limit exact by undoing whichever
        // map landed beyond it (the earlier ones stay).
        usage = await getUsage(user.id);
        if (jobId && usage.used > DAILY_MAP_LIMIT && (await rankToday(user.id, jobId)) >= DAILY_MAP_LIMIT) {
          await sb.from("map_jobs").delete().eq("id", jobId);
          usage = await getUsage(user.id);
          return NextResponse.json({ error: "limit", message: limitMessage(usage), usage }, { status: 429 });
        }
      }
    } catch (err) {
      console.error("map_jobs persistence failed:", err);
    }
  }

  return NextResponse.json({ spec, jobId, engine, rationale, usage, rows });
}

/** This map's position among the user's maps of the last 24 hours (0 = oldest). */
async function rankToday(userId: string, jobId: string): Promise<number> {
  const sb = getServiceSupabase();
  if (!sb) return 0;
  const { data } = await sb
    .from("map_jobs")
    .select("id")
    .eq("user_id", userId)
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  const i = (data ?? []).findIndex((r) => r.id === jobId);
  return i < 0 ? 0 : i;
}

function limitMessage(u: Usage): string {
  const when = u.resetAt ? ` Your next map is available ${relative(u.resetAt)}.` : "";
  return `You've made your ${u.limit} free maps for today.${when} You can still change and download the maps you've made.`;
}

function relative(iso: string): string {
  const mins = Math.max(1, Math.round((new Date(iso).getTime() - Date.now()) / 60000));
  return mins < 60 ? `in ${mins} minute${mins > 1 ? "s" : ""}` : `in about ${Math.round(mins / 60)} hour${mins >= 90 ? "s" : ""}`;
}

/** A title states what and where, in the third person. No questions, no pitch, no "map of". */
function isPlainTitle(t: string): boolean {
  const x = t.trim();
  if (!x || /[?!]/.test(x)) return false;
  if (/^(where|how|why|what|which|who|when|here|this|these|see|explore|discover|meet|map\b|a map|the map|mapping|showing|visuali[sz]ing|tracking|inside|behind)/i.test(x)) return false;
  if (/\b(you|your|our|we|us)\b/i.test(x)) return false;
  if (/\b(are|is)\s*$/i.test(x)) return false;
  return true;
}
