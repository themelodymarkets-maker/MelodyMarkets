import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/layout/PageShell";
import { Card } from "@/components/ui/Card";
import { ArtistHeader } from "@/components/artist/ArtistHeader";
import { MarketStats } from "@/components/artist/MarketStats";
import { PriceChart } from "@/components/artist/PriceChart";
import { PriceDisplay } from "@/components/artist/PriceDisplay";
import { RecentTrades } from "@/components/artist/RecentTrades";
import { TradePanel } from "@/components/artist/TradePanel";
import { computeSpotPrice } from "@/lib/market";
import { fetchPriceHistory, type PriceHistoryRange, type PricePoint } from "@/lib/price-history";
import { createClient } from "@/lib/supabase/server";
import type { Trade } from "@/types/database";

/** The range `PriceChart` renders on first paint, fetched server-side. */
const DEFAULT_PRICE_HISTORY_RANGE: PriceHistoryRange = "1d";

interface ArtistPageProps {
  params: Promise<{ slug: string }>;
}

interface ArtistDetail {
  artistId: string;
  name: string;
  genre: string | null;
  imageUrl: string | null;
  listeners: number | null;
  playcount: number | null;
  currentPrice: number;
  referencePrice: number | null;
  tokenReserve: number;
  shareReserve: number;
  marketCreatedAt: string;
  snapshotCount: number;
  trades: Trade[];
  priceHistory: PricePoint[];
}

/**
 * Single round trip's worth of Supabase calls for the artist detail page:
 * artist + its one-to-one `markets` row, a 24h reference price (same rule as
 * the `get_market_overview` RPC the markets page uses, reimplemented here as
 * two lightweight queries since that RPC only returns *active* artists in
 * bulk rather than one arbitrary artist by slug), the total snapshot count
 * for the "Price history" placeholder, and the latest 20 trades.
 *
 * Wrapped in React's `cache()` so `generateMetadata` and the page component
 * -- both of which need this data -- only trigger one actual fetch per request.
 */
const getArtistDetail = cache(async (slug: string): Promise<ArtistDetail | null> => {
  const supabase = await createClient();

  const { data: artist, error } = await supabase
    .from("artists")
    .select("*, markets(*)")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load artist "${slug}": ${error.message}`);
  }

  if (!artist || !artist.markets) {
    return null;
  }

  const market = artist.markets;
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [recentSnapshot, oldestSnapshot, snapshotCountResult, tradesResult, priceHistory] =
    await Promise.all([
      supabase
        .from("price_snapshots")
        .select("price")
        .eq("artist_id", artist.id)
        .lte("created_at", twentyFourHoursAgo)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("price_snapshots")
        .select("price")
        .eq("artist_id", artist.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("price_snapshots")
        .select("*", { count: "exact", head: true })
        .eq("artist_id", artist.id),
      supabase
        .from("trades")
        .select("*")
        .eq("artist_id", artist.id)
        .order("created_at", { ascending: false })
        .limit(20),
      fetchPriceHistory(supabase, artist.id, DEFAULT_PRICE_HISTORY_RANGE),
    ]);

  const referencePriceRaw = recentSnapshot.data?.price ?? oldestSnapshot.data?.price ?? null;

  return {
    artistId: artist.id,
    name: artist.name,
    genre: artist.genre,
    imageUrl: artist.image_url,
    listeners: artist.listeners,
    playcount: artist.playcount,
    currentPrice: computeSpotPrice(market),
    referencePrice: referencePriceRaw === null ? null : Number(referencePriceRaw),
    tokenReserve: Number(market.token_reserve),
    shareReserve: Number(market.share_reserve),
    marketCreatedAt: market.created_at,
    snapshotCount: snapshotCountResult.count ?? 0,
    trades: tradesResult.data ?? [],
    priceHistory,
  };
});

export async function generateMetadata({ params }: ArtistPageProps): Promise<Metadata> {
  const { slug } = await params;
  const artist = await getArtistDetail(slug);

  if (!artist) {
    return {};
  }

  return {
    title: artist.name,
    description: `Trade ${artist.name} on MelodyMarkets. Live price, chart, and recent trades.`,
  };
}

export default async function ArtistPage({ params }: ArtistPageProps) {
  const { slug } = await params;
  const artist = await getArtistDetail(slug);

  if (!artist) {
    notFound();
  }

  // Resolve the session on the server so the trade panel renders the correct
  // signed-in / signed-out state on the first paint (no flash of the gate).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const marketCap = artist.currentPrice * artist.shareReserve;

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-5xl">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
          <div className="min-w-0">
            <Card>
              <ArtistHeader
                name={artist.name}
                genre={artist.genre}
                imageUrl={artist.imageUrl}
                listeners={artist.listeners}
                playcount={artist.playcount}
              />
            </Card>

            <Card className="mt-6">
              <PriceDisplay
                artistId={artist.artistId}
                initialPrice={artist.currentPrice}
                referencePrice={artist.referencePrice}
              />
            </Card>

            <PriceChart
              artistId={artist.artistId}
              marketCreatedAt={artist.marketCreatedAt}
              initialRange={DEFAULT_PRICE_HISTORY_RANGE}
              initialPoints={artist.priceHistory}
              initialTotalSnapshotCount={artist.snapshotCount}
            />

            <RecentTrades artistId={artist.artistId} initialTrades={artist.trades} />
          </div>

          <div className="flex flex-col gap-6">
            <TradePanel
              artistId={artist.artistId}
              artistName={artist.name}
              initialTokenReserve={artist.tokenReserve}
              initialShareReserve={artist.shareReserve}
              isAuthenticated={user !== null}
            />
            <MarketStats
              marketCap={marketCap}
              snapshotCount={artist.snapshotCount}
              createdAt={artist.marketCreatedAt}
            />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
