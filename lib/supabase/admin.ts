import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for the vita/L0 DB.
 * Bypasses RLS — use only in trusted server-side contexts (background jobs,
 * Trigger.dev tasks, migrations). Never expose this client to the browser.
 */
export function getSupabaseAdminClient() {
  const url = process.env.L0_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.L0_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing L0_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
