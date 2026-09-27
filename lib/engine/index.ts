/**
 * The CartoMapper engine — the backbone every map goes through:
 *
 *   1. readBrief  — what was asked: place, units, subject, intent (brief.ts)
 *   2. design     — the rulebook's map, every decision with its reason (rulebook.ts)
 *   3. the AI designer may propose a better one, given 1 and 2 (mapspec/claude.ts)
 *   4. inspect    — checks that correct any spec that contradicts the brief, the
 *                   data or cartographic practice, and log each correction (inspect.ts)
 *
 * Without an AI key, steps 1, 2 and 4 alone produce the map.
 */
import type { MapSpec, Decision } from "@/lib/mapspec/schema";
import { parseMapSpec } from "@/lib/mapspec/schema";
import { profileTable } from "@/lib/mapspec/profile";
import { readBrief, type Brief } from "./brief";
import { design, type Facts } from "./rulebook";
import { inspect } from "./inspect";

export { readBrief, design, inspect };
export type { Brief, Facts };

export interface EngineRun {
  brief: Brief;
  plan: ReturnType<typeof design>;
}

export function plan(facts: Omit<Facts, "brief"> & { prompt: string }): EngineRun {
  const brief = readBrief(facts.prompt, { hasData: Boolean(facts.table?.rows.length) });
  return { brief, plan: design({ ...facts, brief }) };
}

/**
 * Hold a proposed spec (from the AI, or a revision) to the engine's checks. The
 * decision log keeps the rulebook's reasoning, the AI's where it differs, and every
 * correction.
 */
export function finalize(
  proposed: MapSpec,
  run: EngineRun,
  facts: Omit<Facts, "brief">,
  opts: { aiDecisions?: Decision[]; revision?: string } = {},
): MapSpec {
  const profile = facts.table?.rows.length && facts.roles ? profileTable(facts.table, facts.roles) : null;
  const r = (opts.revision ?? "").toLowerCase();
  const { spec, fixes } = inspect(proposed, {
    brief: run.brief,
    profile,
    resolved: facts.resolved,
    // A revision may move the map on purpose ("show the whole of Africa"); hold it to
    // its own geography rather than the original brief's.
    reference: opts.revision ? parseMapSpec({ ...run.plan.spec, geography: proposed.geography, title: proposed.title }) : run.plan.spec,
    userSet: {
      title: Boolean(facts.userTitle) || /title|call it|name it/.test(r),
      orientation: /portrait|landscape/.test(r),
      furniture: /legend|scale|north|grid|graticule|arrow|label|place name/.test(r),
      style: /atlas|classic|minimal|physical|political/.test(r),
      palette: /colou?r|green|blue|red|purple|orange|grey|gray|brown|pink|teal/.test(r),
    },
  });
  const decisions = opts.aiDecisions?.length ? [...opts.aiDecisions, ...fixes] : [...run.plan.decisions, ...fixes];
  return parseMapSpec({ ...spec, decisions });
}
