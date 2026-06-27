import { NextResponse } from "next/server";
import { generateMapSpecHeuristic, applyRevisionHeuristic, type GenerateInput } from "@/lib/mapspec/generate";
import { generateMapSpecWithClaude, hasAnthropic } from "@/lib/mapspec/claude";
import { parseMapSpec, MAP_TYPES, type MapSpec } from "@/lib/mapspec/schema";
import { getServiceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
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
  };

  const revision = body.previousSpec
    ? {
        previousSpec: parseMapSpec(body.previousSpec),
        revisionRequest: body.revisionRequest ? String(body.revisionRequest) : undefined,
      }
    : undefined;

  let spec: MapSpec;
  let engine: "claude" | "rules" = "rules";
  try {
    if (hasAnthropic()) {
      spec = await generateMapSpecWithClaude(input, revision);
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
  }
  if (Object.keys(overrides).length) spec = parseMapSpec({ ...spec, ...overrides });

  // User furniture toggles always win over the engine's choices.
  if (body.outputOptions) {
    spec = parseMapSpec({
      ...spec,
      furniture: { ...spec.furniture, ...(body.outputOptions as object) },
    });
  }

  // Best-effort persistence (skipped entirely when Supabase isn't configured).
  let jobId: string | null = (body.jobId as string) ?? null;
  const sb = getServiceSupabase();
  if (sb) {
    try {
      if (jobId) {
        await sb
          .from("map_jobs")
          .update({
            map_spec: spec,
            status: "preview",
            output_options: spec.furniture,
            revision_count: Number(body.revisionCount ?? 0),
          })
          .eq("id", jobId);
      } else {
        const { data } = await sb
          .from("map_jobs")
          .insert({
            session_id: String(body.sessionId ?? "anon"),
            industry: input.industry,
            custom_industry: input.customIndustry ?? null,
            vibe_prompt: input.vibe || null,
            answers: input.answers ?? {},
            uploaded_data: input.table
              ? { columns: input.table.columns, rows: input.table.rows.slice(0, 2000), roles: input.roles }
              : null,
            map_spec: spec,
            status: "preview",
            output_options: spec.furniture,
          })
          .select("id")
          .single();
        jobId = data?.id ?? null;
      }
    } catch (err) {
      console.error("map_jobs persistence skipped:", err);
    }
  }

  return NextResponse.json({ spec, jobId, engine });
}
