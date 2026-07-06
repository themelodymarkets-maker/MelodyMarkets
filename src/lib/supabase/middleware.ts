import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Routes that require an authenticated user. Visitors are sent to /login. */
const PROTECTED_PREFIXES = ["/portfolio"];

/**
 * Runs on every request (via middleware) to keep the Supabase session alive.
 *
 * Access tokens are short-lived. Calling getUser() here triggers a refresh when
 * needed and writes the updated tokens onto the outgoing response cookies, so
 * both the browser and future server renders always have a fresh session.
 * It also gate-keeps protected routes.
 */
export async function updateSession(request: NextRequest) {
  // Start with a pass-through response we can attach refreshed cookies to.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Mirror updated cookies onto both the request (for this pass) and
          // the response (so the browser receives the refreshed session).
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
      global: {
        // Force every Supabase network call to bypass the platform fetch
        // cache, so the session check below always reflects the latest
        // cookies instead of a memoized response from another request.
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
    },
  );

  // IMPORTANT: do not run any logic between client creation and getUser().
  // Doing so risks logging users out at random due to unrefreshed tokens.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  // Redirect unauthenticated visitors away from protected routes.
  if (!user && isProtected) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    const redirectResponse = NextResponse.redirect(redirectUrl);
    redirectResponse.headers.set("Cache-Control", "private, no-store");
    return redirectResponse;
  }

  // Every response that passes through this middleware may carry a fresh
  // session cookie (Set-Cookie) or reflect a per-user auth state. On Vercel,
  // responses without an explicit Cache-Control header can be cached at the
  // CDN/edge layer, which would leak one user's session (or logged-out state)
  // to the next visitor. `private, no-store` guarantees every request is
  // evaluated fresh and never shared between users or reused after sign-out.
  response.headers.set("Cache-Control", "private, no-store");

  // Must return this exact response so refreshed cookies are preserved.
  return response;
}
