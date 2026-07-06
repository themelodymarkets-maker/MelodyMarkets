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

  // Look up the display name to show in the nav when signed in.
  let username: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();
    username = profile?.username ?? null;
  }

  return <HeaderNav username={username} />;
}
