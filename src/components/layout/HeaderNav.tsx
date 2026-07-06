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

/**
 * Client-side navigation shell.
 *
 * The session state is resolved on the server (see Header) and passed in as
 * props, so this component only owns interactivity: the mobile menu toggle
 * and the sign-out action.
 *
 * It also subscribes to Supabase's auth events directly. This is a safety
 * net: `router.refresh()` calls made elsewhere (login/signup pages) normally
 * re-render this Server Component with fresh props, but if one of those
 * calls is ever missed, delayed, or dropped by the client-side route cache,
 * this listener independently notices the SIGNED_IN / SIGNED_OUT event and
 * forces a refresh, so the nav can never get stuck showing the wrong state.
 */
export function HeaderNav({ isAuthenticated, username }: HeaderNavProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // Re-fetch this Server Component's props whenever the sign-in state
      // actually flips, so the nav can never drift out of sync with cookies.
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        router.refresh();
      }
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
    setIsMenuOpen(false);
    setIsSigningOut(false);
    // Send the user home and refresh so the server re-reads the (now empty)
    // session and every Server Component (including this nav) updates.
    router.push("/");
    router.refresh();
  }

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
          {isAuthenticated ? (
            <>
              <span className="text-sm font-medium text-foreground">{username}</span>
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
              {isAuthenticated ? (
                <div className="flex flex-col gap-2">
                  <span className="px-3 text-sm font-medium text-foreground">{username}</span>
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
