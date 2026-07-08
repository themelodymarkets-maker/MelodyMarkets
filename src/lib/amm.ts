/**
 * Pure constant-product AMM math for MelodyMarkets.
 *
 * This module has NO side effects and NO server-only dependencies, so it is
 * safe to import from client components and unit tests. It mirrors the
 * on-Postgres `execute_trade` function's formulas exactly (constant product +
 * 1% fee) and is used for instant, display-only UI previews of what a trade
 * would return BEFORE it is actually submitted.
 *
 * IMPORTANT: the SQL function remains the single source of truth for economic
 * writes -- `quoteTrade` is only a preview. See `src/lib/trade.ts` (which
 * re-exports everything here) for the server-side executor and typed errors.
 */

/** Protocol fee taken on every trade: 1%. Kept in the pool (deepens liquidity). */
export const TRADE_FEE_RATE = 0.01;

/**
 * Multiplier applied to the "user-facing" side of a swap. Mirrors the
 * `c_fee_factor` constant in the SQL function. 0.99 == keep 99%, retain 1%.
 */
export const FEE_FACTOR = 1 - TRADE_FEE_RATE;

export type TradeSide = "buy" | "sell";

export interface Reserves {
  /** Tokens held by the pool. */
  tokenReserve: number;
  /** Shares held by the pool. */
  shareReserve: number;
}

export interface TradeQuote {
  side: TradeSide;
  /** Shares that change hands (bought on a buy, sold on a sell). */
  shares: number;
  /** Tokens that change hands: spent on a buy, received (net of fee) on a sell. */
  tokens: number;
  /** Effective execution price = tokens / shares. */
  pricePerShare: number;
  /** Pool token reserve after the trade. */
  newTokenReserve: number;
  /** Pool share reserve after the trade. */
  newShareReserve: number;
  /** Post-trade spot price = newTokenReserve / newShareReserve. */
  newMarketPrice: number;
}

/**
 * Preview a trade against a snapshot of the reserves, using the identical
 * formulas as the `execute_trade` SQL function.
 *
 * BUY (`amount` = tokens to spend):
 *   effective_in = amount * 0.99   (only 99% prices the swap; the withheld 1%
 *                                   still enters token_reserve -> deepens liquidity)
 *   shares_out   = share_reserve
 *                  - (token_reserve * share_reserve) / (token_reserve + effective_in)
 *   The FULL amount is added to token_reserve; shares_out leaves share_reserve.
 *
 * SELL (`amount` = shares to sell):
 *   tokens_gross = token_reserve
 *                  - (token_reserve * share_reserve) / (share_reserve + amount)
 *   tokens_out   = tokens_gross * 0.99   (user receives 99%; the withheld 1%
 *                                         stays in token_reserve)
 *   share_reserve gains `amount`; only the NET tokens_out leaves token_reserve.
 *
 * @throws {RangeError} if reserves are non-positive or `amount` is not > 0.
 */
export function quoteTrade(reserves: Reserves, side: TradeSide, amount: number): TradeQuote {
  const { tokenReserve, shareReserve } = reserves;

  if (!(tokenReserve > 0) || !(shareReserve > 0)) {
    throw new RangeError("Reserves must be strictly positive.");
  }
  if (!(amount > 0)) {
    throw new RangeError("Trade amount must be a positive number.");
  }
  if (side !== "buy" && side !== "sell") {
    throw new RangeError("Trade side must be 'buy' or 'sell'.");
  }

  if (side === "buy") {
    const effectiveIn = amount * FEE_FACTOR;
    const sharesOut = shareReserve - (tokenReserve * shareReserve) / (tokenReserve + effectiveIn);

    const newTokenReserve = tokenReserve + amount;
    const newShareReserve = shareReserve - sharesOut;

    return {
      side,
      shares: sharesOut,
      tokens: amount,
      pricePerShare: amount / sharesOut,
      newTokenReserve,
      newShareReserve,
      newMarketPrice: newTokenReserve / newShareReserve,
    };
  }

  const tokensGross = tokenReserve - (tokenReserve * shareReserve) / (shareReserve + amount);
  const tokensOut = tokensGross * FEE_FACTOR;

  const newShareReserve = shareReserve + amount;
  const newTokenReserve = tokenReserve - tokensOut;

  return {
    side,
    shares: amount,
    tokens: tokensOut,
    pricePerShare: tokensOut / amount,
    newTokenReserve,
    newShareReserve,
    newMarketPrice: newTokenReserve / newShareReserve,
  };
}
