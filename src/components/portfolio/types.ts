import type { Trade } from "@/types/database";

/** One row of the positions table: a held artist joined with its live market reserves. */
export interface PortfolioPositionData {
  artistId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  /** Shares currently held (numeric(30,8) in Postgres, always coerced to number here). */
  shares: number;
  /** Total tokens ever spent to acquire the currently-held shares. */
  totalCostBasis: number;
  tokenReserve: number;
  shareReserve: number;
}

/** A trade history row, with just enough artist info to link back to `/artist/[slug]`. */
export interface PortfolioTradeRow extends Trade {
  artists: { name: string; slug: string } | null;
}
