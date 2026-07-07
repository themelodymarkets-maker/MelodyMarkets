import { PageShell } from "@/components/layout/PageShell";
import { Card } from "@/components/ui/Card";
import { ComingSoonCard } from "@/components/ui/ComingSoonCard";
import { createClient } from "@/lib/supabase/server";

interface MarketListItem {
  artistId: string;
  name: string;
  /** Spot price in tokens per share: token_reserve / share_reserve. */
  price: number;
}

/**
 * Minimal read of current market state, just to prove artist ingestion data
 * flows all the way to the page. The full trading UI (charts, buy/sell,
 * images, genres, etc.) lands in the next milestone.
 */
async function getMarketListItems(): Promise<MarketListItem[]> {
  const supabase = await createClient();

  const [{ data: markets, error: marketsError }, { data: artists, error: artistsError }] =
    await Promise.all([
      supabase.from("markets").select("artist_id, token_reserve, share_reserve"),
      supabase.from("artists").select("id, name"),
    ]);

  if (marketsError || artistsError || !markets || !artists) {
    return [];
  }

  const nameByArtistId = new Map(artists.map((artist) => [artist.id, artist.name]));

  return markets
    .map((market) => ({
      artistId: market.artist_id,
      name: nameByArtistId.get(market.artist_id) ?? "Unknown artist",
      price: Number(market.token_reserve) / Number(market.share_reserve),
    }))
    .sort((a, b) => b.price - a.price);
}

export default async function MarketsPage() {
  const markets = await getMarketListItems();

  if (markets.length === 0) {
    return (
      <PageShell>
        <ComingSoonCard
          title="Markets"
          description="Live artist prices and trading will show up here soon."
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-lg">
        <h1 className="text-2xl font-semibold text-foreground">Markets</h1>
        <p className="mt-2 text-sm text-muted">
          Full trading UI is coming in the next milestone -- current prices below.
        </p>
        <Card className="mt-6 divide-y divide-border p-0">
          {markets.map((market) => (
            <div key={market.artistId} className="flex items-center justify-between px-6 py-4">
              <span className="font-medium text-foreground">{market.name}</span>
              <span className="text-accent-gradient font-semibold">
                {market.price.toFixed(2)} tokens
              </span>
            </div>
          ))}
        </Card>
      </div>
    </PageShell>
  );
}
