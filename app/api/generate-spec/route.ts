import { NextResponse } from "next/server";
import { generateMapSpecHeuristic, applyRevisionHeuristic, type GenerateInput } from "@/lib/mapspec/generate";
import { generateMapSpecWithClaude, hasAnthropic } from "@/lib/mapspec/claude";
import { parseMapSpec, MAP_TYPES, GEO_LEVELS, type MapSpec } from "@/lib/mapspec/schema";
import { getServiceSupabase } from "@/lib/supabase/server";
import { advanceJob, getJob, isLocalJobId } from "@/lib/jobs";
import { isPaid, PAID_REVISIONS_INCLUDED } from "@/lib/workflow";

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

  let spec: MapSpec;
  let engine: "claude" | "rules" = "rules";
  let rationale: unknown = null;
  try {
    if (hasAnthropic()) {
      const design = await generateMapSpecWithClaude(input, revision);
      spec = design.spec;
      rationale = design.rationale;
      engine = "claude";
    } else if (revision?.revisionRequest && revision.previousSpec) {
      spec = applyRevisionHeuristic(revision.previousSpec, revision.revisionRequest);
    } else {
      spec = generateMapSpecHeuristic(input);
    }
  } catch (err) {
    console.error("generate-spec falling back to rules engine:", err);
    spec =
      revision?.revisionRequest && revision.previousSpec
        ? applyRevisionHeuristic(revision.previousSpec, revision.revisionRequest)
        : generateMapSpecHeuristic(input);
    engine = "rules";
  }

  // User choices (map type, title, branding) override the engine's guesses.
  const overrides: Record<string, unknown> = {};
  if (body.branding && typeof body.branding === "object") overrides.branding = body.branding;
  if (!revision) {
    if (typeof body.mapType === "string" && (MAP_TYPES as readonly string[]).includes(body.mapType)) {
      overrides.mapType = body.mapType;
    }
    if (body.title) overrides.title = String(body.title);
    // Where the data itself says the map is (resolved from the user's places) beats a guess.
    const g = body.geography as { level?: string; region?: string } | undefined;
    if (g && (GEO_LEVELS as readonly string[]).includes(String(g.level))) {
      overrides.geography = { ...spec.geography, level: g.level, region: g.region ?? spec.geography.region };
      // Furniture conventions follow the (now known) scale: no scale bar on a world map,
      // no graticule on a country map.
      // The AI designer already chose furniture knowing the geography; the rules engine didn't.
      if (engine === "rules") {
        const small = g.level === "world" || g.level === "continent";
        overrides.furniture = { ...spec.furniture, scalebar: !small, north_arrow: g.level !== "world", graticule: small };
      }
    }
  }
  if (Object.keys(overrides).length) spec = parseMapSpec({ ...spec, ...overrides });

  // User furniture toggles always win over the engine's choices.
  if (body.outputOptions) {
    spec = parseMapSpec({
      ...spec,
      furniture: { ...spec.furniture, ...(body.outputOptions as object) },
    });
  }

  // Persistence + the revision gate (skipped entirely when Supabase isn't configured).
  //  • unpaid maps: any number of changes while previewing
  //  • paid maps:   PAID_REVISIONS_INCLUDED change(s) stay on the paid job; after that a
  //                 change becomes a new map (a new, unpaid job) — the paid one is kept.
  let jobId: string | null = (body.jobId as string) ?? null;
  let newJob = false;
  const sb = getServiceSupabase();
  if (sb) {
    try {
      const existing = jobId && !isLocalJobId(jobId) ? await getJob(jobId) : null;
      if (existing && isPaid(existing.status) && existing.paid_revisions_used < PAID_REVISIONS_INCLUDED) {
        await sb
          .from("map_jobs")
          .update({ map_spec: spec, output_options: spec.furniture, paid_revisions_used: existing.paid_revisions_used + 1 })
          .eq("id", existing.id);
      } else if (existing && !isPaid(existing.status)) {
        await sb
          .from("map_jobs")
          .update({ map_spec: spec, output_options: spec.furniture, revision_count: Number(body.revisionCount ?? 0) })
          .eq("id", existing.id);
        await advanceJob(existing.id, "preview");
      } else {
        newJob = Boolean(existing);
        const { data } = await sb
          .from("map_jobs")
          .insert({
            session_id: String(body.sessionId ?? "anon"),
            industry: input.industry,
            custom_industry: input.customIndustry ?? null,
            vibe_prompt: input.vibe || null,
            answers: input.answers ?? {},
            uploaded_data: input.table
              ? { columns: input.table.columns, rows: input.table.rows.slice(0, 5000), roles: input.roles }
              : null,
            map_spec: spec,
            status: "preview",
            output_options: spec.furniture,
            revision_of: existing?.id ?? null,
          })
          .select("id")
          .single();
        jobId = data?.id ?? null;
      }
    } catch (err) {
      console.error("map_jobs persistence skipped:", err);
    }
  }

  return NextResponse.json({ spec, jobId, engine, newJob, rationale });
}
