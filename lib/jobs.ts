import { getServiceSupabase } from "@/lib/supabase/server";

export interface JobRow {
  id: string;
  user_id: string | null;
  created_at: string;
  map_spec: unknown;
  uploaded_data: { columns: string[]; rows: Record<string, unknown>[] } | null;
  revision_count: number;
}

/** A saved map, only if it belongs to `userId`. */
export async function getOwnJob(jobId: string, userId: string): Promise<JobRow | null> {
  const sb = getServiceSupabase();
  if (!sb || !jobId || !userId || !/^[0-9a-f-]{36}$/i.test(jobId)) return null;
  const { data, error } = await sb
    .from("map_jobs")
    .select("id, user_id, created_at, map_spec, uploaded_data, revision_count")
    .eq("id", jobId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) return null;
  return { ...data, revision_count: data.revision_count ?? 0 } as JobRow;
}

export interface JobSummary {
  id: string;
  created_at: string;
  title: string;
  mapType: string | null;
  style: string | null;
  region: string | null;
}

/** The user's maps, newest first. */
export async function listOwnJobs(userId: string, limit = 60): Promise<JobSummary[]> {
  const sb = getServiceSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from("map_jobs")
    .select("id, created_at, map_spec")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => {
    const s = (r.map_spec ?? {}) as { title?: string; mapType?: string; style?: string; geography?: { region?: string } };
    return {
      id: r.id as string,
      created_at: r.created_at as string,
      title: s.title ?? "Untitled map",
      mapType: s.mapType ?? null,
      style: s.style ?? null,
      region: s.geography?.region ?? null,
    };
  });
}
