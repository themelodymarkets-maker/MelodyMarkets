import "server-only";

/**
 * Minimal typed client for the subset of the Last.fm REST API MelodyMarkets
 * needs to seed and refresh artist data.
 *
 * Docs: https://www.last.fm/api
 *
 * Politeness: Last.fm has no official documented rate limit, but hammering it
 * with concurrent requests is a fast way to get throttled. Every multi-artist
 * helper here (`getTopArtistsWithDetails`) issues requests sequentially, one
 * artist at a time, with a short delay between calls.
 */

const LASTFM_API_BASE_URL = "https://ws.audioscrobbler.com/2.0/";

/** Delay between sequential Last.fm requests so we stay polite to their API. */
const REQUEST_DELAY_MS = 250;

/** Abort any single Last.fm request that takes longer than this. */
const REQUEST_TIMEOUT_MS = 10_000;

export type LastfmErrorCode =
  | "missing_api_key"
  | "timeout"
  | "network_error"
  | "api_error"
  | "invalid_response";

/** A typed error thrown by every network-calling function in this module. */
export class LastfmError extends Error {
  readonly code: LastfmErrorCode;

  constructor(code: LastfmErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "LastfmError";
    this.code = code;
  }
}

/** A single entry from `chart.getTopArtists`. */
export interface LastfmTopArtist {
  name: string;
  listeners: number;
  playcount: number;
}

/** The fields we care about from `artist.getInfo`. */
export interface LastfmArtistDetails {
  name: string;
  listeners: number;
  playcount: number;
  /** Top user-supplied tag, used as a rough primary genre. Null if untagged. */
  genre: string | null;
  /**
   * Best available promotional image. Last.fm frequently returns an empty
   * string for every image size, so this always falls back to a
   * deterministic, generated placeholder avatar when no real image exists --
   * callers can rely on this field never being empty.
   */
  imageUrl: string;
}

// ---------------------------------------------------------------------------
// Raw Last.fm response shapes (internal). Last.fm's JSON API represents
// numbers as strings, so these are parsed into proper numbers before leaving
// this module.
// ---------------------------------------------------------------------------

interface LastfmImage {
  "#text": string;
  size: string;
}

interface LastfmApiErrorBody {
  error?: number;
  message?: string;
}

interface RawTopArtistsResponse extends LastfmApiErrorBody {
  artists?: {
    artist?: Array<{
      name: string;
      listeners: string;
      playcount: string;
    }>;
  };
}

interface RawArtistInfoResponse extends LastfmApiErrorBody {
  artist?: {
    name: string;
    stats?: { listeners: string; playcount: string };
    tags?: { tag?: Array<{ name: string }> };
    image?: LastfmImage[];
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getApiKey(): string {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) {
    throw new LastfmError(
      "missing_api_key",
      "LASTFM_API_KEY is not set. Add it to your environment (see .env.local).",
    );
  }
  return apiKey;
}

/**
 * Builds a stable, deterministic avatar for artists with no real Last.fm
 * image, seeded by name so the same artist always gets the same placeholder.
 */
function placeholderAvatarUrl(name: string): string {
  const seed = encodeURIComponent(name.trim().toLowerCase());
  return `https://api.dicebear.com/9.x/initials/svg?seed=${seed}&backgroundType=gradientLinear`;
}

/** Picks the largest non-empty image URL Last.fm returned, if any. */
function bestImageUrl(images: LastfmImage[] | undefined): string | null {
  if (!images || images.length === 0) return null;
  // Last.fm orders images small -> mega; walk backwards to prefer the largest.
  for (let i = images.length - 1; i >= 0; i -= 1) {
    const url = images[i]?.["#text"]?.trim();
    if (url) return url;
  }
  return null;
}

async function lastfmGet<T extends LastfmApiErrorBody>(
  method: string,
  params: Record<string, string>,
): Promise<T> {
  const apiKey = getApiKey();
  const url = new URL(LASTFM_API_BASE_URL);
  url.search = new URLSearchParams({
    ...params,
    method,
    api_key: apiKey,
    format: "json",
  }).toString();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal, cache: "no-store" });
  } catch (cause) {
    if (controller.signal.aborted) {
      throw new LastfmError(
        "timeout",
        `Last.fm request timed out after ${REQUEST_TIMEOUT_MS}ms (${method}).`,
        { cause },
      );
    }
    throw new LastfmError("network_error", `Last.fm request failed (${method}).`, { cause });
  } finally {
    clearTimeout(timeoutId);
  }

  let body: T;
  try {
    body = (await response.json()) as T;
  } catch (cause) {
    throw new LastfmError("invalid_response", `Last.fm returned non-JSON response (${method}).`, {
      cause,
    });
  }

  if (!response.ok || body.error) {
    const detail = body.message ?? response.statusText ?? "unknown error";
    throw new LastfmError(
      "api_error",
      `Last.fm API error${body.error ? ` ${body.error}` : ""} for ${method}: ${detail}`,
    );
  }

  return body;
}

/** Fetches the global top `limit` artists by listener chart. */
export async function getTopArtists(limit = 10): Promise<LastfmTopArtist[]> {
  const body = await lastfmGet<RawTopArtistsResponse>("chart.gettopartists", {
    limit: String(limit),
  });

  const artists = body.artists?.artist;
  if (!artists) {
    throw new LastfmError(
      "invalid_response",
      "Last.fm chart.getTopArtists response was missing an artist list.",
    );
  }

  return artists.map((artist) => ({
    name: artist.name,
    listeners: Number(artist.listeners) || 0,
    playcount: Number(artist.playcount) || 0,
  }));
}

/** Fetches detailed stats (listeners, playcount, top tag, image) for one artist. */
export async function getArtistInfo(name: string): Promise<LastfmArtistDetails> {
  const body = await lastfmGet<RawArtistInfoResponse>("artist.getinfo", { artist: name });

  const artist = body.artist;
  if (!artist) {
    throw new LastfmError(
      "invalid_response",
      `Last.fm artist.getInfo response was missing artist data for "${name}".`,
    );
  }

  const topTag = artist.tags?.tag?.[0]?.name ?? null;

  return {
    name: artist.name,
    listeners: Number(artist.stats?.listeners) || 0,
    playcount: Number(artist.stats?.playcount) || 0,
    genre: topTag,
    imageUrl: bestImageUrl(artist.image) ?? placeholderAvatarUrl(artist.name),
  };
}

/**
 * Fetches the global top `limit` artists along with their full details.
 *
 * Requests are made sequentially (never in parallel), with a short delay
 * between each `artist.getInfo` call, to stay polite to Last.fm's API.
 */
export async function getTopArtistsWithDetails(limit = 10): Promise<LastfmArtistDetails[]> {
  const topArtists = await getTopArtists(limit);
  const details: LastfmArtistDetails[] = [];

  for (let i = 0; i < topArtists.length; i += 1) {
    details.push(await getArtistInfo(topArtists[i].name));
    if (i < topArtists.length - 1) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  return details;
}
