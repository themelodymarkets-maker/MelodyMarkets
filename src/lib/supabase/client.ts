import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Creates a Supabase client for use in the browser (Client Components).
 *
 * This client reads the public URL and anon key, which are safe to expose to
 * the browser because Row Level Security on the database restricts what they
 * can actually do. Use it for interactive auth flows like signing in and up.
 *
 * A fresh client is created per call; `createBrowserClient` internally reuses a
 * singleton, so this is cheap and keeps components free of shared module state.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
