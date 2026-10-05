import { createHash } from "node:crypto";
import { getServiceSupabase } from "@/lib/supabase/server";

/**
 * Shared limits for the account endpoints (sign-up, reset codes, deletion), kept in
 * Postgres so they hold across every serverless instance. Keys are hashed, so the
 * table never stores an email or IP address in the clear.
 *
 * If the `rate_hit` function isn't installed yet (supabase/schema.sql), requests are
 * let through and the gap is logged, so a missing migration can't lock anyone out.
 */
export async function allow(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const sb = getServiceSupabase();
  if (!sb) return true;
  const hashed = createHash("sha256").update(key).digest("hex");
  const { data, error } = await sb.rpc("rate_hit", { p_key: hashed, p_window_seconds: windowSeconds, p_max: max });
  if (error) {
    console.error("[rate-limit] rate_hit unavailable, allowing:", error.message);
    return true;
  }
  return data !== false;
}

/** The visitor's IP as Netlify reports it. */
export function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-nf-client-connection-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

export const tooMany = (what = "tries") =>
  Response.json({ error: `Too many ${what}. Please wait a few minutes and try again.` }, { status: 429 });
