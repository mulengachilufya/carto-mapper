import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Browser Supabase client (anon key). Null when env vars are absent so the app
 * still runs locally before any keys are configured.
 */
export const browserSupabase = url && anon ? createClient(url, anon) : null;
