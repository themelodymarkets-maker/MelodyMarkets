import { computePercentChange, type PercentChange } from "./format";
import type { Market } from "@/types/database";

/**
 * Spot price for a market: token_reserve / share_reserve (see
 * `supabase/migrations/20260706190200_create_markets_table.sql` for the AMM
 * invariant this implements). Postgres `numeric` columns are serialized as
 * strings over the wire, so both reserves are explicitly cast with `Number`.
 */
export function computeSpotPrice(market: Pick<Market, "token_reserve" | "share_reserve">): number {
  return Number(market.token_reserve) / Number(market.share_reserve);
}

export interface PriceChangeInput {
  currentPrice: number;
  referencePrice: number | null;
}

/**
 * The 24h price-change rule shared by every page that renders a
 * `PriceChangePill`: compare the current price against a 24h-ago reference
 * price, falling back to the current price itself (a flat 0%) when no
 * reference price exists yet -- e.g. a freshly listed artist. This mirrors
 * the reference-price rule implemented server-side by `get_market_overview`
 * (see `supabase/migrations/20260708120000_add_market_overview_and_public_reads.sql`),
 * so the markets watchlist and the artist detail page always agree.
 */
export function get24hPriceChange({ currentPrice, referencePrice }: PriceChangeInput): PercentChange {
  return computePercentChange(referencePrice ?? currentPrice, currentPrice);
}
