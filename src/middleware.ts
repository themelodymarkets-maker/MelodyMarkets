import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/** Delegate to the Supabase session-refresh + route-guard helper. */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  /**
   * Run on all paths except Next.js internals and static asset requests.
   * Keeping images/fonts out of the matcher avoids needless token refreshes.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
