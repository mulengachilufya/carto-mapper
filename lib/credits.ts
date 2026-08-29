import { getServiceSupabase } from "@/lib/supabase/server";

/** Sum of unused credits across every pack this session has bought. */
export async function getRemainingCredits(sessionId: string): Promise<number> {
  const sb = getServiceSupabase();
  if (!sb || !sessionId) return 0;

  const { data, error } = await sb
    .from("credit_purchases")
    .select("credits_remaining")
    .eq("session_id", sessionId)
    .gt("credits_remaining", 0);

  if (error || !data) return 0;
  return data.reduce((sum, row) => sum + (row.credits_remaining ?? 0), 0);
}

/**
 * Spends one credit for this session and marks the given job "paid".
 * Uses an optimistic-concurrency update (only decrements if the row still has
 * the count we just read) so two tabs can't double-spend the same credit.
 * Returns true only if both the debit and the job update succeeded.
 */
export async function consumeCredit(sessionId: string, jobId: string): Promise<boolean> {
  const sb = getServiceSupabase();
  if (!sb || !sessionId || !jobId) return false;

  const { data: rows, error } = await sb
    .from("credit_purchases")
    .select("id, credits_remaining")
    .eq("session_id", sessionId)
    .gt("credits_remaining", 0)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error || !rows || rows.length === 0) return false;
  const row = rows[0];

  const { data: debited, error: debitErr } = await sb
    .from("credit_purchases")
    .update({ credits_remaining: row.credits_remaining - 1 })
    .eq("id", row.id)
    .eq("credits_remaining", row.credits_remaining) // fails silently if someone else already spent it
    .select("id");

  if (debitErr || !debited || debited.length === 0) return false;

  const { error: jobErr } = await sb.from("map_jobs").update({ status: "paid" }).eq("id", jobId);
  if (jobErr) {
    // Couldn't mark the job paid — put the credit back.
    await sb.from("credit_purchases").update({ credits_remaining: row.credits_remaining }).eq("id", row.id);
    return false;
  }
  return true;
}
