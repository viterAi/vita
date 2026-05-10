import { createBrowserClient } from "@supabase/ssr";

export function getSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_L0_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_L0_SUPABASE_ANON_KEY!,
  );
}
