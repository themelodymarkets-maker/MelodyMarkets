import type { Metadata } from "next";

export const SITE_NAME = "MelodyMarkets";

export const SITE_DESCRIPTION =
  "Trade virtual shares of your favorite music artists using in-game tokens. Climb the leaderboard as artist buzz shifts.";

/** Canonical app URL for OG tags and redirects. Falls back for local dev. */
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/** Builds a page title with the MelodyMarkets suffix. */
export function pageTitle(title?: string): string {
  return title ? `${title} · ${SITE_NAME}` : SITE_NAME;
}

/** Shared metadata fields merged into every route. */
export function baseMetadata(): Metadata {
  const siteUrl = getSiteUrl();

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: SITE_NAME,
      template: `%s · ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
    },
  };
}
