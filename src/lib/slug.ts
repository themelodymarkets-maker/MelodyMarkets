/**
 * URL-safe slug helpers used when ingesting artists.
 *
 * Slugs are generated once, at first insert, and then kept stable forever
 * (see `src/app/api/admin/seed/route.ts`) so links to `/artists/<slug>` never
 * break even if an artist's display name is later tweaked upstream.
 */

/** Converts an arbitrary display name into a lowercase, hyphenated slug. */
export function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    // Strip diacritics (e.g. "Beyonc\u00e9" -> "Beyonce").
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  // Guard against names with no ASCII-alphanumeric characters at all.
  return slug.length > 0 ? slug : "artist";
}

/**
 * Returns `base` if it isn't already taken, otherwise appends `-2`, `-3`, ...
 * until a free slug is found. Mutates nothing; callers own tracking `taken`.
 */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) {
    return base;
  }

  let suffix = 2;
  let candidate = `${base}-${suffix}`;
  while (taken.has(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}
