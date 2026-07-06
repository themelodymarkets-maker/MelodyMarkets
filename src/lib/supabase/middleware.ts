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
    return NextResponse.redirect(redirectUrl);
  }

  // Must return this exact response so refreshed cookies are preserved.
  return response;
}
