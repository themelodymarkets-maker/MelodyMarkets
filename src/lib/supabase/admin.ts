import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Creates a Supabase "admin" client authenticated with the service-role key.
 *
 * The service-role key bypasses Row Level Security, so it must NEVER reach the
 * browser. The `server-only` import above makes the build fail if this module
 * is ever imported into client-side code, giving us a hard safety guarantee.
 *
 * Use this only for trusted server-side work that legitimately needs elevated
 * access (for example, administrative scripts or privileged lookups).
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        // This client is stateless: it should not persist or auto-refresh any
        // user session, since it acts on behalf of the server, not a user.
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
