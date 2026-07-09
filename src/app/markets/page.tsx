import { PageShell } from "@/components/layout/PageShell";
import { MarketsExplorer } from "@/components/markets/MarketsExplorer";
import type { MarketRowData } from "@/components/markets/types";
import { createClient } from "@/lib/supabase/server";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Server Component data fetch: the only place this page talks to Supabase.
 * A single RPC call (`get_market_overview`, defined in
 * supabase/migrations/20260708120000_add_market_overview_and_public_reads.sql)
 * joins active artists, their market, and a 24h-ago price_snapshots lookup
 * server-side, so the page never has to stitch multiple tables together (or
 * make N+1 requests) in the browser.
 *
 * Postgres `numeric` columns are serialized as strings over the wire (to
 * avoid float precision loss), so every numeric field is explicitly cast
 * with `Number(...)` here, before any plain data crosses into client
 * components.
 *
 * A thrown error here is caught by the nearest `error.tsx` boundary
 * (`app/markets/error.tsx`); Next.js renders `app/markets/loading.tsx`
 * automatically while this await is in flight.
 */
async function getMarketRows(): Promise<MarketRowData[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_market_overview");

  if (error) {
    throw new Error(`Failed to load market overview: ${error.message}`);
  }

  const rows = data ?? [];
  const artistIds = rows.map((row) => row.artist_id);
  const sparklinesByArtist = await getSparklines(supabase, artistIds);

  return rows.map((row) => ({
    artistId: row.artist_id,
    slug: row.slug,
    name: row.name,
    genre: row.genre,
    imageUrl: row.image_url,
    listeners: row.listeners === null ? null : Number(row.listeners),
    currentPrice: Number(row.current_price),
    referencePrice: row.reference_price === null ? null : Number(row.reference_price),
    sparkline: sparklinesByArtist.get(row.artist_id) ?? [],
  }));
}

/**
 * Last 24h of real `price_snapshots` prices for every given artist, fetched
 * in exactly one grouped query (rather than one query per row) and then
 * bucketed client-side by `artist_id`. Every value returned is a real
 * recorded price -- see the "Price history & charts" note in
 * ARCHITECTURE.md -- this never generates a point for an artist with no
 * snapshots in the window; such rows simply get an empty sparkline.
 */
async function getSparklines(
  supabase: Awaited<ReturnType<typeof createClient>>,
  artistIds: string[],
): Promise<Map<string, number[]>> {
  const sparklines = new Map<string, number[]>();
  if (artistIds.length === 0) return sparklines;

  const since = new Date(Date.now() - TWENTY_FOUR_HOURS_MS).toISOString();
  const { data, error } = await supabase
    .from("price_snapshots")
    .select("artist_id, price, created_at")
    .in("artist_id", artistIds)
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  if (error) {
    // A sparkline is a nice-to-have glance, not core market data -- log and
    // fall back to empty sparklines rather than failing the whole page.
    console.error("Failed to load market sparklines:", error.message);
    return sparklines;
  }

  for (const row of data ?? []) {
    const prices = sparklines.get(row.artist_id) ?? [];
    prices.push(Number(row.price));
    sparklines.set(row.artist_id, prices);
  }

  return sparklines;
}

export default async function MarketsPage() {
  const rows = await getMarketRows();

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-5xl">
        {/*
          Server/Client boundary: everything above this comment ran on the
          server. `MarketsExplorer` below is a Client Component -- search,
          sort, and the Supabase Realtime subscription all need browser
          state/effects -- and it receives the already-fetched rows as plain
          serializable props, with no data fetching of its own on mount.
        */}
        <MarketsExplorer initialRows={rows} />
      </div>
    </PageShell>
  );
}
