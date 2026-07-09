import { computeSpotPrice } from "./market";

/**
 * Portfolio math -- the client-side twin of
 * `supabase/migrations/20260709120000_create_portfolio_summary_function.sql`.
 *
 * The SQL migration is the single source of truth for these formulas (and
 * the only place the *aggregate* per-user numbers are computed, via
 * `get_portfolio_summary()`). This module re-implements the same formulas in
 * TypeScript so the portfolio page can recompute them on every Realtime
 * price tick without a round trip to Postgres -- see
 * `src/components/portfolio/PortfolioView.tsx`. If you change a formula
 * here, change it in that migration too (and vice versa); they must always
 * agree.
 */

export interface PositionInput {
  /** Shares currently held. Always >= 0 (see `holdings.shares` check constraint). */
  shares: number;
  /** Total tokens ever spent to acquire the currently-held shares. */
  totalCostBasis: number;
  /** Current AMM reserves for this position's artist. */
  tokenReserve: number;
  shareReserve: number;
}

export interface PositionMetrics {
  /** token_reserve / share_reserve. */
  currentPrice: number;
  /** shares * currentPrice. */
  marketValue: number;
  /** totalCostBasis / shares. 0 when shares is 0 (avoids a divide-by-zero). */
  averageCost: number;
  /** marketValue - totalCostBasis. */
  unrealizedPl: number;
  /** unrealizedPl / totalCostBasis * 100. 0 when totalCostBasis is 0. */
  unrealizedPlPercent: number;
}

/** Per-position market value, average cost, and unrealized P/L (see module header). */
export function computePositionMetrics({
  shares,
  totalCostBasis,
  tokenReserve,
  shareReserve,
}: PositionInput): PositionMetrics {
  const currentPrice = computeSpotPrice({ token_reserve: tokenReserve, share_reserve: shareReserve });
  const marketValue = shares * currentPrice;
  const averageCost = shares > 0 ? totalCostBasis / shares : 0;
  const unrealizedPl = marketValue - totalCostBasis;
  const unrealizedPlPercent = totalCostBasis > 0 ? (unrealizedPl / totalCostBasis) * 100 : 0;

  return { currentPrice, marketValue, averageCost, unrealizedPl, unrealizedPlPercent };
}

export interface PortfolioTotalsInput {
  /** Sum of the user's token_ledger rows (same definition as `get_token_balance`). */
  tokenBalance: number;
  /** Sum of every position's market value (see `computePositionMetrics`). */
  holdingsValue: number;
  /** Sum of token_ledger rows credited via 'signup_bonus' or 'stripe_purchase'. */
  totalCredited: number;
}

export interface PortfolioTotals {
  /** tokenBalance + holdingsValue. */
  totalValue: number;
  /** (totalValue - totalCredited) / totalCredited * 100. 0 when totalCredited is 0. */
  returnPercent: number;
}

/** Total portfolio value and total return % (see module header). */
export function computePortfolioTotals({
  tokenBalance,
  holdingsValue,
  totalCredited,
}: PortfolioTotalsInput): PortfolioTotals {
  const totalValue = tokenBalance + holdingsValue;
  const returnPercent = totalCredited > 0 ? ((totalValue - totalCredited) / totalCredited) * 100 : 0;

  return { totalValue, returnPercent };
}
