import { PageShell } from "@/components/layout/PageShell";
import { MarketsExplorer } from "@/components/markets/MarketsExplorer";
import type { MarketRowData } from "@/components/markets/types";
import { createClient } from "@/lib/supabase/server";

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

  return (data ?? []).map((row) => ({
    artistId: row.artist_id,
    slug: row.slug,
    name: row.name,
    genre: row.genre,
    imageUrl: row.image_url,
    listeners: row.listeners === null ? null : Number(row.listeners),
    currentPrice: Number(row.current_price),
    referencePrice: row.reference_price === null ? null : Number(row.reference_price),
  }));
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
