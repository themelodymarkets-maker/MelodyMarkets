"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/layout/Logo";
import { LinkButton } from "@/components/ui/LinkButton";
import { Button } from "@/components/ui/Button";
import { NAV_LINKS } from "@/lib/nav-links";
import { createClient } from "@/lib/supabase/client";

interface HeaderNavProps {
  /** Whether the server saw a valid session when this layout last rendered. */
  isAuthenticated: boolean;
  /** Display name of the signed-in user, or null when signed out. */
  username: string | null;
}

/** Local, client-owned view of the sign-in state that the header renders. */
interface AuthDisplayState {
  isAuthenticated: boolean;
  username: string | null;
}

/**
 * Client-side navigation shell.
 *
 * The session state is first resolved on the server (see Header) and passed
 * in as props, so the very first paint is correct with no flash of the wrong
 * button. From then on, this component owns the *live* state itself: it
 * subscribes to `supabase.auth.onAuthStateChange` and updates local React
 * state directly whenever a SIGNED_IN, SIGNED_OUT, or USER_UPDATED event
 * fires, so the header flips instantly (log out, sign in, sign up) without
 * ever depending on a server round-trip or a manual page refresh.
 *
 * A `router.refresh()` is still fired alongside those updates, but only to
 * reconcile secondary server-rendered data (like the profile username) in
 * the background — the visible header state never waits on it.
 */
export function HeaderNav({ isAuthenticated, username }: HeaderNavProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [authState, setAuthState] = useState<AuthDisplayState>({
    isAuthenticated,
    username,
  });
  const router = useRouter();

  // Keep local state in sync with fresh server props (e.g. after a hard
  // navigation or an unrelated router.refresh()), without overriding it on
  // every render.
  useEffect(() => {
    setAuthState({ isAuthenticated, username });
  }, [isAuthenticated, username]);

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setAuthState({ isAuthenticated: false, username: null });
      } else if (
        event === "SIGNED_IN" ||
        event === "USER_UPDATED" ||
        event === "TOKEN_REFRESHED"
      ) {
        const user = session?.user ?? null;
        setAuthState({
          isAuthenticated: user !== null,
          // Optimistic display name from the auth payload itself, so the
          // header never waits on a database round-trip to flip. The
          // background refresh below reconciles this with the real
          // `profiles.username` once the server has re-rendered.
          username: user
            ? ((user.user_metadata?.username as string | undefined) ??
              user.email?.split("@")[0] ??
              "Account")
            : null,
        });
      } else {
        return;
      }

      // Re-sync server-rendered data (like the DB profile lookup) in the
      // background. The header itself already reflects the new state above,
      // so this is not on the critical path for the visual update.
      router.refresh();
    });

    return () => subscription.unsubscribe();
  }, [router]);

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    // signOut() clears the session from both local storage and the cookies
    // that the browser client manages, so the server will see a logged-out
    // user on the very next request.
    await supabase.auth.signOut();
    // Flip the header immediately rather than waiting for the
    // onAuthStateChange event or a navigation to land.
    setAuthState({ isAuthenticated: false, username: null });
    setIsMenuOpen(false);
    setIsSigningOut(false);
    router.push("/");
  }

  const { isAuthenticated: isSignedIn, username: displayName } = authState;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />

        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm font-medium text-muted transition-colors duration-200 hover:text-foreground"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          {isSignedIn ? (
            <>
              <span className="text-sm font-medium text-foreground">{displayName}</span>
              <Button
                variant="secondary"
                onClick={handleSignOut}
                disabled={isSigningOut}
              >
                {isSigningOut ? "Signing out…" : "Sign Out"}
              </Button>
            </>
          ) : (
            <LinkButton href="/login">Sign In</LinkButton>
          )}
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors duration-200 hover:bg-surface md:hidden"
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMenuOpen}
          aria-controls="mobile-menu"
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <MenuIcon isOpen={isMenuOpen} />
        </button>
      </div>

      {isMenuOpen && (
        <nav id="mobile-menu" aria-label="Mobile" className="border-t border-border md:hidden">
          <ul className="flex flex-col gap-1 px-4 py-4 sm:px-6">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors duration-200 hover:bg-surface hover:text-foreground"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="pt-2">
              {isSignedIn ? (
                <div className="flex flex-col gap-2">
                  <span className="px-3 text-sm font-medium text-foreground">{displayName}</span>
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                  >
                    {isSigningOut ? "Signing out…" : "Sign Out"}
                  </Button>
                </div>
              ) : (
                <LinkButton href="/login" className="w-full" onClick={() => setIsMenuOpen(false)}>
                  Sign In
                </LinkButton>
              )}
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}

function MenuIcon({ isOpen }: { isOpen: boolean }) {
  if (isOpen) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
