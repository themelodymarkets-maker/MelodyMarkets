import { createClient } from "@/lib/supabase/server";
import { HeaderNav } from "@/components/layout/HeaderNav";

/**
 * Top-level navigation.
 *
 * This is an async Server Component so the user's session is read on the server
 * before any HTML is sent. That means the correct signed-in / signed-out state
 * is rendered immediately, with no client-side flash of the wrong buttons.
 */
export async function Header() {
  const supabase = await createClient();

  // getUser() re-validates the token with Supabase, so it is safe to trust
  // (unlike getSession(), which only reads the local cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Whether to show "Sign Out" is decided purely from `user`. The profile
  // lookup below is only used for the *display name*: if it fails or the
  // row is momentarily missing, an authenticated user must still see the
  // Sign Out button rather than incorrectly falling back to "Sign In".
  let username: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();
    // Fall back to the email prefix so we always have something to display.
    username = profile?.username ?? user.email?.split("@")[0] ?? "Account";
  }

  return <HeaderNav isAuthenticated={user !== null} username={username} />;
}
