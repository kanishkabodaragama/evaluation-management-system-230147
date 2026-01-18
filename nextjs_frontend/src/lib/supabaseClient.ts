import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client for browser usage (static-export safe).
 *
 * Next.js `output: "export"` prerenders certain pages during build. If we throw
 * at module import time due to missing env vars, the build fails.
 *
 * Therefore we lazily create the client only when variables are present.
 * If they're missing at runtime and the app tries to use Supabase, we throw a
 * clear error.
 */
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  // Support both variable names:
  // - NEXT_PUBLIC_SUPABASE_ANON_KEY (preferred; matches Supabase docs)
  // - NEXT_PUBLIC_SUPABASE_KEY (provided by container_env in this workspace)
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_KEY). Please set them in the environment.",
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

let cachedClient: ReturnType<typeof getSupabaseClient> | null = null;

/**
 * Returns a cached Supabase client instance.
 */
export function getSupabase() {
  if (!cachedClient) cachedClient = getSupabaseClient();
  return cachedClient;
}

/**
 * Convenience export for codepaths that expect `supabase`.
 * Note: calling methods will throw if env vars are not set.
 */
export const supabase = new Proxy({} as ReturnType<typeof getSupabaseClient>, {
  get(_target, prop) {
    const client = getSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (client as any)[prop];
  },
});
