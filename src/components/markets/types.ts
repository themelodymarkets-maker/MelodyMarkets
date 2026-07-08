/**
 * Plain, already-numeric shape the markets watchlist works with everywhere
 * client-side. Built once on the server from the `get_market_overview` RPC
 * row (see `app/markets/page.tsx`), then kept in sync in the browser by
 * `MarketsExplorer`'s Realtime subscription.
 */
export interface MarketRowData {
  artistId: string;
  slug: string;
  name: string;
  genre: string | null;
  imageUrl: string | null;
  listeners: number | null;
  /** Spot price in tokens per share: token_reserve / share_reserve. */
  currentPrice: number;
  /** 24h-ago (or oldest available) reference price; see the RPC's migration for the exact rule. */
  referencePrice: number | null;
}

export type SortField = "price" | "change" | "popularity";
export type SortDirection = "asc" | "desc";
