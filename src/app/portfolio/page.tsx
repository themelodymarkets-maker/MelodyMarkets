import type { Metadata } from "next";
import { PageShell } from "@/components/layout/PageShell";
import { PortfolioView } from "@/components/portfolio/PortfolioView";
import type { PortfolioPositionData, PortfolioTradeRow } from "@/components/portfolio/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Track your token balance, open positions, unrealized P/L, and trade history.",
};

/** Trades per page shown by `PortfolioTradeHistory`; kept in sync with that component's own constant. */
const TRADE_HISTORY_PAGE_SIZE = 10;

interface PortfolioData {
  tokenBalance: number;
  totalCredited: number;
  positions: PortfolioPositionData[];
  trades: PortfolioTradeRow[];
  tradeCount: number;
}

/**
 * Server Component data fetch for /portfolio (auth-protected by
 * `src/lib/supabase/middleware.ts`, so `userId` is always a real signed-in
 * user by the time this runs). Three independent reads, in parallel:
 *
 *  1. `get_portfolio_summary` RPC -- the single source of truth for token
 *     balance and total credited tokens (see
 *     `supabase/migrations/20260709120000_create_portfolio_summary_function.sql`
 *     for the full definitions this page mirrors client-side for live
 *     updates).
 *  2. The user's open positions (`holdings` joined to `artists`), used to
 *     render the positions table.
 *  3. The first page of the user's trade history, newest first, joined to
 *     `artists` so each row can link back to `/artist/[slug]`.
 *
 * Market reserves for the held artists are fetched separately (rather than
 * nested-embedded through `holdings -> artists -> markets`) so the shape
 * stays simple and obviously correct -- one extra `IN` query is a
 * negligible cost next to the clarity gained.
 */
async function getPortfolioData(userId: string): Promise<PortfolioData> {
  const supabase = await createClient();

  const [summaryResult, holdingsResult, tradesResult] = await Promise.all([
    supabase.rpc("get_portfolio_summary", { p_user_id: userId }).single(),
    supabase
      .from("holdings")
      .select("artist_id, shares, total_cost_basis, artists(name, slug, image_url)")
      .eq("user_id", userId)
      .gt("shares", 0),
    supabase
      .from("trades")
      .select("*, artists(name, slug)", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(0, TRADE_HISTORY_PAGE_SIZE - 1),
  ]);

  if (summaryResult.error) {
    throw new Error(`Failed to load portfolio summary: ${summaryResult.error.message}`);
  }
  if (holdingsResult.error) {
    throw new Error(`Failed to load holdings: ${holdingsResult.error.message}`);
  }
  if (tradesResult.error) {
    throw new Error(`Failed to load trade history: ${tradesResult.error.message}`);
  }

  const holdings = holdingsResult.data ?? [];
  const holdingArtistIds = holdings.map((holding) => holding.artist_id);

  const { data: marketsData, error: marketsError } = holdingArtistIds.length
    ? await supabase
        .from("markets")
        .select("artist_id, token_reserve, share_reserve")
        .in("artist_id", holdingArtistIds)
    : { data: [], error: null };

  if (marketsError) {
    throw new Error(`Failed to load market reserves: ${marketsError.message}`);
  }

  const marketsByArtistId = new Map((marketsData ?? []).map((market) => [market.artist_id, market]));

  const positions: PortfolioPositionData[] = holdings
    .filter((holding) => holding.artists !== null && marketsByArtistId.has(holding.artist_id))
    .map((holding) => {
      const artist = holding.artists!;
      const market = marketsByArtistId.get(holding.artist_id)!;

      return {
        artistId: holding.artist_id,
        slug: artist.slug,
        name: artist.name,
        imageUrl: artist.image_url,
        shares: Number(holding.shares),
        totalCostBasis: Number(holding.total_cost_basis),
        tokenReserve: Number(market.token_reserve),
        shareReserve: Number(market.share_reserve),
      };
    });

  return {
    tokenBalance: Number(summaryResult.data?.token_balance ?? 0),
    totalCredited: Number(summaryResult.data?.total_credited ?? 0),
    positions,
    trades: (tradesResult.data ?? []) as unknown as PortfolioTradeRow[],
    tradeCount: tradesResult.count ?? 0,
  };
}

export default async function PortfolioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already redirects unauthenticated requests to /login before
  // this ever renders (see PROTECTED_PREFIXES in
  // src/lib/supabase/middleware.ts). This check exists only so TypeScript
  // knows `user` is non-null below, and so this fails safely rather than
  // crashing if that guarantee is ever weakened.
  if (!user) {
    return null;
  }

  const { tokenBalance, totalCredited, positions, trades, tradeCount } = await getPortfolioData(
    user.id,
  );

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="display-label text-xl text-foreground">Portfolio</h1>
        <p className="mt-1 text-sm text-muted">Your holdings, performance, and trade history.</p>

        <div className="mt-6">
          <PortfolioView
            userId={user.id}
            positions={positions}
            tokenBalance={tokenBalance}
            totalCredited={totalCredited}
            initialTrades={trades}
            initialTradeCount={tradeCount}
          />
        </div>
      </div>
    </PageShell>
  );
}
