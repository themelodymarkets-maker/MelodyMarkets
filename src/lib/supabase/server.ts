import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Creates a Supabase client for use on the server (Server Components, Route
 * Handlers, and Server Actions).
 *
 * The client reads and writes the user's session through Next.js cookies so
 * that authentication state stays in sync between the server and the browser.
 *
 * Note: when called from a Server Component, cookie writes are not allowed by
 * Next.js. We swallow those errors because the middleware is responsible for
 * refreshing and persisting the session cookie on every request.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Read every cookie so Supabase can find the session tokens.
        getAll() {
          return cookieStore.getAll();
        },
        // Persist refreshed session tokens back onto the response.
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component where setting cookies is not
            // permitted. Safe to ignore because middleware refreshes sessions.
          }
        },
      },
      global: {
        // Next.js extends the global `fetch` with its own caching layer.
        // Without this override, a request like `auth.getUser()` could be
        // memoized by Vercel's Data Cache and silently reused for a later
        // request from a *different* user. `cache: "no-store"` forces every
        // Supabase network call from this client to always hit the network.
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
    },
  );
}
