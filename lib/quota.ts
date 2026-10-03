import { getServiceSupabase } from "@/lib/supabase/server";
import { DAILY_MAP_LIMIT } from "@/lib/quota-rules";

export { DAILY_MAP_LIMIT, CHANGES_PER_MAP } from "@/lib/quota-rules";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface Usage {
  used: number;
  limit: number;
  remaining: number;
  /** When the oldest map in the window ages out and a slot frees up (ISO), if at the limit. */
  resetAt: string | null;
}

export async function getUsage(userId: string): Promise<Usage> {
  const sb = getServiceSupabase();
  if (!sb) return { used: 0, limit: DAILY_MAP_LIMIT, remaining: DAILY_MAP_LIMIT, resetAt: null };
  const since = new Date(Date.now() - DAY_MS).toISOString();
  const { data, count } = await sb
    .from("map_jobs")
    .select("created_at", { count: "exact" })
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(1);
  const used = count ?? 0;
  const oldest = data?.[0]?.created_at as string | undefined;
  return {
    used,
    limit: DAILY_MAP_LIMIT,
    remaining: Math.max(0, DAILY_MAP_LIMIT - used),
    resetAt: used >= DAILY_MAP_LIMIT && oldest ? new Date(new Date(oldest).getTime() + DAY_MS).toISOString() : null,
  };
}
