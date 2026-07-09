import "server-only";

import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getArtistInfo, LastfmError } from "@/lib/lastfm";
import type { TablesInsert } from "@/types/database";

// This route writes with the service-role key and calls the Last.fm API; it
// must only ever run in a Node.js server environment, never the Edge runtime.
export const runtime = "nodejs";

/**
 * Delay between sequential `artist.getInfo` calls so this job stays polite to
 * Last.fm's API, mirroring the same politeness rule as
 * `getTopArtistsWithDetails` in src/lib/lastfm.ts.
 */
const LASTFM_REQUEST_DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface SnapshotSummary {
  marketsSnapshotted: number;
  artistsRefreshed: number;
  artistsRefreshFailed: number;
}

interface ActiveMarketRow {
  artist_id: string;
  lastfm_name: string;
  token_reserve: number;
  share_reserve: number;
}

/**
 * GET /api/cron/snapshot
 *
 * Hourly (see `vercel.json`) point-in-time price recording job: for every
 * active artist's market, inserts exactly one `price_snapshots` row at the
 * market's current spot price (source: 'cron'). This -- together with the
 * 'trade'-sourced rows written by `execute_trade` -- is the entire, honest
 * source of every chart on the site; this route never backfills, averages,
 * or otherwise fabricates a point.
 *
 * It also opportunistically refreshes each artist's Last.fm listeners/
 * playcount. That refresh is best-effort: a Last.fm failure for one artist
 * (or all of them) is logged and skipped, and never fails the snapshot pass
 * itself, since recording price history is the job's actual purpose.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runSnapshot();
    return NextResponse.json(summary satisfies SnapshotSummary);
  } catch (error) {
    console.error("[api/cron/snapshot] failed:", error);
    return NextResponse.json({ error: "Failed to record price snapshots." }, { status: 500 });
  }
}

async function runSnapshot(): Promise<SnapshotSummary> {
  const supabase = createAdminClient();

  // ---- 1. Read every active market's current reserves ---------------------
  // `artists!inner` scopes the join to active artists only, matching the
  // `is_active` filter `get_market_overview` uses for the public watchlist --
  // a delisted artist's market should stop accumulating new price history.
  const { data: rows, error: readError } = await supabase
    .from("markets")
    .select("artist_id, token_reserve, share_reserve, artists!inner(lastfm_name, is_active)")
    .eq("artists.is_active", true);
  if (readError) throw readError;

  const activeMarkets: ActiveMarketRow[] = (rows ?? []).map((row) => ({
    artist_id: row.artist_id,
    lastfm_name: row.artists.lastfm_name,
    token_reserve: Number(row.token_reserve),
    share_reserve: Number(row.share_reserve),
  }));

  if (activeMarkets.length === 0) {
    return { marketsSnapshotted: 0, artistsRefreshed: 0, artistsRefreshFailed: 0 };
  }

  // ---- 2. Insert one real, current price_snapshots row per market ---------
  const snapshotRows: TablesInsert<"price_snapshots">[] = activeMarkets.map((market) => ({
    artist_id: market.artist_id,
    price: market.token_reserve / market.share_reserve,
    source: "cron",
  }));

  const { error: insertError } = await supabase.from("price_snapshots").insert(snapshotRows);
  if (insertError) throw insertError;

  // ---- 3. Best-effort Last.fm refresh, one artist at a time ----------------
  let artistsRefreshed = 0;
  let artistsRefreshFailed = 0;
  const nowIso = new Date().toISOString();

  for (let i = 0; i < activeMarkets.length; i += 1) {
    const market = activeMarkets[i];
    try {
      const details = await getArtistInfo(market.lastfm_name);
      const { error: updateError } = await supabase
        .from("artists")
        .update({ listeners: details.listeners, playcount: details.playcount, updated_at: nowIso })
        .eq("id", market.artist_id);
      if (updateError) throw updateError;
      artistsRefreshed += 1;
    } catch (error) {
      artistsRefreshFailed += 1;
      const detail = error instanceof LastfmError ? error.message : String(error);
      console.error(`[api/cron/snapshot] Last.fm refresh failed for "${market.lastfm_name}": ${detail}`);
    }

    if (i < activeMarkets.length - 1) {
      await sleep(LASTFM_REQUEST_DELAY_MS);
    }
  }

  return {
    marketsSnapshotted: activeMarkets.length,
    artistsRefreshed,
    artistsRefreshFailed,
  };
}
