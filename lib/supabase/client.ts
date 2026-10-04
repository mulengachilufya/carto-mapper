import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Browser Supabase client. Cookie-backed (not localStorage) so the server sees the
 * same session. Null when accounts aren't configured, the site then runs open.
 */
export const browserSupabase = url && anon ? createBrowserClient(url, anon) : null;
