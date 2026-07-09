import "server-only";

import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTopArtistsWithDetails, LastfmError } from "@/lib/lastfm";
import { slugify, uniqueSlug } from "@/lib/slug";
import type { TablesInsert } from "@/types/database";

// This route talks to the Last.fm API and writes with the service-role key;
// it must only ever run in a Node.js server environment, never the Edge
// runtime or the browser.
export const runtime = "nodejs";

/** How many of Last.fm's global top artists to ingest per run. */
const TOP_ARTISTS_COUNT = 10;

// ---------------------------------------------------------------------------
// Initial pricing rule (see markets table migration for the AMM invariant
// this seeds into: price = token_reserve / share_reserve).
//
// New markets start at 1,000,000 shares in the pool, priced so that more
// popular artists start more expensive: 1 token of price per 1,000,000
// monthly Last.fm listeners, clamped to a sane [MIN_PRICE, MAX_PRICE] band so
// obscure artists don't start at (near) zero and mega-popular artists don't
// start absurdly high. token_reserve is derived so that
// token_reserve / share_reserve == price on day one.
//
// This rule ONLY applies at market creation. Once a market exists, real
// trades own its reserves -- this route never rewrites token_reserve or
// share_reserve for an existing market.
// ---------------------------------------------------------------------------
const LISTENERS_PER_PRICE_UNIT = 1_000_000;
const MIN_INITIAL_PRICE = 1;
const MAX_INITIAL_PRICE = 500;
const INITIAL_SHARE_RESERVE = 1_000_000;

function computeInitialPrice(listeners: number): number {
  const rawPrice = listeners / LISTENERS_PER_PRICE_UNIT;
  return Math.min(MAX_INITIAL_PRICE, Math.max(MIN_INITIAL_PRICE, rawPrice));
}

interface SeedSummary {
  artistsCreated: number;
  artistsUpdated: number;
  marketsCreated: number;
}

/**
 * POST /api/admin/seed
 *
 * Cron-triggered ingestion job: pulls the current global top artists from
 * Last.fm, upserts them into `artists`, and creates a starter `markets` row
 * (plus one `price_snapshots` row) for any artist that doesn't have a market
 * yet. Fully idempotent -- running this repeatedly converges rather than
 * duplicating data (see inline comments below for how each step guarantees
 * that).
 */
export async function POST(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runSeed();
    return NextResponse.json(summary satisfies SeedSummary);
  } catch (error) {
    console.error("[api/admin/seed] failed:", error);
    const message =
      error instanceof LastfmError
        ? `Last.fm error: ${error.message}`
        : "Failed to seed artists and markets.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

async function runSeed(): Promise<SeedSummary> {
  const supabase = createAdminClient();

  const lastfmArtists = await getTopArtistsWithDetails(TOP_ARTISTS_COUNT);
  if (lastfmArtists.length === 0) {
    return { artistsCreated: 0, artistsUpdated: 0, marketsCreated: 0 };
  }
  const lastfmNames = lastfmArtists.map((artist) => artist.name);

  // ---- 1. Upsert artists, generating a slug only for genuinely new rows ----
  //
  // `lastfm_name` is the unique conflict target: re-running this job with the
  // same top-10 list always resolves to the same rows via ON CONFLICT UPDATE,
  // so artists are never duplicated. For an already-known artist we reuse its
  // existing slug verbatim (never regenerate it), so a slug is guaranteed
  // stable for the lifetime of the artist even if a later run's naive slug
  // would collide with something else by then.
  const { data: existingArtists, error: existingArtistsError } = await supabase
    .from("artists")
    .select("id, lastfm_name, slug")
    .in("lastfm_name", lastfmNames);
  if (existingArtistsError) throw existingArtistsError;

  const existingByLastfmName = new Map(existingArtists?.map((row) => [row.lastfm_name, row]));

  const { data: allSlugRows, error: allSlugsError } = await supabase.from("artists").select("slug");
  if (allSlugsError) throw allSlugsError;
  const takenSlugs = new Set(allSlugRows?.map((row) => row.slug));

  const nowIso = new Date().toISOString();
  let artistsCreated = 0;

  const artistUpsertRows: TablesInsert<"artists">[] = lastfmArtists.map((artist) => {
    const existing = existingByLastfmName.get(artist.name);

    let slug: string;
    if (existing) {
      slug = existing.slug;
    } else {
      slug = uniqueSlug(slugify(artist.name), takenSlugs);
      takenSlugs.add(slug);
      artistsCreated += 1;
    }

    return {
      name: artist.name,
      slug,
      lastfm_name: artist.name,
      image_url: artist.imageUrl,
      genre: artist.genre,
      listeners: artist.listeners,
      playcount: artist.playcount,
      updated_at: nowIso,
    };
  });

  const { data: upsertedArtists, error: upsertArtistsError } = await supabase
    .from("artists")
    .upsert(artistUpsertRows, { onConflict: "lastfm_name" })
    .select("id, listeners");
  if (upsertArtistsError) throw upsertArtistsError;
  if (!upsertedArtists) throw new Error("Artist upsert returned no rows.");

  const artistsUpdated = upsertedArtists.length - artistsCreated;

  // ---- 2. Create a market for any artist that doesn't have one yet --------
  //
  // Markets are looked up by `artist_id` (unique in the schema) and only ever
  // INSERTed here, never updated -- so re-running this job against artists
  // that already have a market is a no-op for that artist's reserves.
  const artistIds = upsertedArtists.map((artist) => artist.id);
  const { data: existingMarkets, error: existingMarketsError } = await supabase
    .from("markets")
    .select("artist_id")
    .in("artist_id", artistIds);
  if (existingMarketsError) throw existingMarketsError;

  const artistIdsWithMarket = new Set(existingMarkets?.map((market) => market.artist_id));

  const newMarkets = upsertedArtists
    .filter((artist) => !artistIdsWithMarket.has(artist.id))
    .map((artist) => ({
      artistId: artist.id,
      price: computeInitialPrice(artist.listeners ?? 0),
    }));

  let marketsCreated = 0;
  if (newMarkets.length > 0) {
    const marketRows: TablesInsert<"markets">[] = newMarkets.map(({ artistId, price }) => ({
      artist_id: artistId,
      share_reserve: INITIAL_SHARE_RESERVE,
      token_reserve: price * INITIAL_SHARE_RESERVE,
    }));

    const { data: insertedMarkets, error: insertMarketsError } = await supabase
      .from("markets")
      .insert(marketRows)
      .select("artist_id");
    if (insertMarketsError) throw insertMarketsError;
    marketsCreated = insertedMarkets?.length ?? 0;

    // ---- 3. One 'cron' price snapshot per newly created market only -------
    // Existing markets already have their own trade/cron history; we must
    // never insert a fabricated point into that history on later runs.
    const snapshotRows: TablesInsert<"price_snapshots">[] = newMarkets.map(
      ({ artistId, price }) => ({
        artist_id: artistId,
        price,
        source: "cron",
      }),
    );

    const { error: insertSnapshotsError } = await supabase
      .from("price_snapshots")
      .insert(snapshotRows);
    if (insertSnapshotsError) throw insertSnapshotsError;
  }

  return { artistsCreated, artistsUpdated, marketsCreated };
}
