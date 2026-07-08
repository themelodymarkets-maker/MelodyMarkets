/**
 * Client/server trade helpers for the MelodyMarkets AMM.
 *
 * Two things are surfaced here:
 *
 *   1. The PURE AMM math (`quoteTrade`, `FEE_FACTOR`, `TRADE_FEE_RATE`, and the
 *      `Reserves` / `TradeQuote` / `TradeSide` types). These now live in
 *      `src/lib/amm.ts` -- a module with no server-only dependencies -- and are
 *      re-exported below so existing imports of `@/lib/trade` keep working.
 *      Client components should import the pure math directly from `@/lib/amm`
 *      to avoid pulling this module's server-only executor into their bundle.
 *
 *   2. `executeTrade` -- the server-side wrapper around the `execute_trade`
 *      Postgres function (see
 *      supabase/migrations/20260708160000_create_execute_trade_function.sql).
 *      It resolves the logged-in user, calls the RPC as that user, and maps the
 *      database's distinct exceptions to typed, user-friendly errors.
 *
 * IMPORTANT: the SQL function is the single source of truth for economic
 * writes. `quoteTrade` is only a preview -- the real amounts a user receives
 * are whatever `executeTrade` returns, computed atomically against the live,
 * row-locked reserves. Always pass a `minReceive` derived from a quote so the
 * server rejects the trade (SLIPPAGE_EXCEEDED) if the market moved underneath
 * the preview.
 */

// Re-export the pure AMM math so `@/lib/trade` keeps its original public API.
export {
  TRADE_FEE_RATE,
  FEE_FACTOR,
  quoteTrade,
  type TradeSide,
  type Reserves,
  type TradeQuote,
} from "./amm";

import type { TradeSide } from "./amm";

// ---------------------------------------------------------------------------
// Typed errors + server-side executor.
// ---------------------------------------------------------------------------

/**
 * Stable codes mirroring the distinct exceptions raised by `execute_trade`.
 * `UNKNOWN` covers anything unexpected (network, auth, etc.).
 */
export type TradeErrorCode =
  | "NOT_AUTHENTICATED"
  | "FORBIDDEN_USER"
  | "INVALID_SIDE"
  | "INVALID_AMOUNT"
  | "UNKNOWN_MARKET"
  | "INSUFFICIENT_BALANCE"
  | "INSUFFICIENT_SHARES"
  | "SLIPPAGE_EXCEEDED"
  | "UNKNOWN";

/** User-friendly copy for each failure mode. */
const TRADE_ERROR_MESSAGES: Record<TradeErrorCode, string> = {
  NOT_AUTHENTICATED: "You must be signed in to trade.",
  FORBIDDEN_USER: "You can only trade on your own account.",
  INVALID_SIDE: "Invalid trade type. Choose buy or sell.",
  INVALID_AMOUNT: "Enter an amount greater than zero.",
  UNKNOWN_MARKET: "This market is not available for trading.",
  INSUFFICIENT_BALANCE: "You don't have enough tokens for this purchase.",
  INSUFFICIENT_SHARES: "You don't have enough shares to sell.",
  SLIPPAGE_EXCEEDED:
    "The price moved past your limit before the trade completed. Try again.",
  UNKNOWN: "Something went wrong while placing your trade. Please try again.",
};

/** A trade failure with a machine-readable `code` and a user-friendly `message`. */
export class TradeError extends Error {
  readonly code: TradeErrorCode;

  constructor(code: TradeErrorCode, message?: string) {
    super(message ?? TRADE_ERROR_MESSAGES[code]);
    this.name = "TradeError";
    this.code = code;
  }
}

/**
 * Maps a raw Postgres/PostgREST error message to a `TradeErrorCode`. The SQL
 * function raises each condition with a distinct leading token (e.g.
 * `SLIPPAGE_EXCEEDED`), which PostgREST surfaces in `error.message`.
 */
export function mapDatabaseError(message: string | null | undefined): TradeErrorCode {
  const text = message ?? "";
  const codes: TradeErrorCode[] = [
    "FORBIDDEN_USER",
    "INVALID_SIDE",
    "INVALID_AMOUNT",
    "UNKNOWN_MARKET",
    "INSUFFICIENT_BALANCE",
    "INSUFFICIENT_SHARES",
    "SLIPPAGE_EXCEEDED",
  ];
  return codes.find((code) => text.includes(code)) ?? "UNKNOWN";
}

/** Shape of the JSON object returned by the `execute_trade` RPC. */
export interface ExecuteTradeResult {
  tradeId: string;
  side: TradeSide;
  shares: number;
  tokens: number;
  pricePerShare: number;
  marketPrice: number;
  tokenBalance: number;
}

export interface ExecuteTradeInput {
  artistId: string;
  side: TradeSide;
  /** Tokens to spend (buy) or shares to sell (sell). */
  amount: number;
  /**
   * Minimum acceptable output (shares on a buy, tokens on a sell). The server
   * raises SLIPPAGE_EXCEEDED if the actual output would fall below this.
   * Defaults to 0 (accept any non-negative output) but callers should derive
   * it from a `quoteTrade` preview with a tolerance.
   */
  minReceive?: number;
}

/**
 * Executes a trade for the currently signed-in user by calling the
 * `execute_trade` Postgres function as that user (their JWT flows through the
 * cookie-based Supabase client, so the function's `auth.uid()` assertion holds
 * -- users can only ever trade as themselves).
 *
 * Server-only: it reads the session from Next.js cookies. The Supabase server
 * client is imported dynamically so this module stays safe to import from
 * client components and unit tests purely for `quoteTrade` / the pure helpers.
 *
 * @throws {TradeError} with a typed `code` on any failure.
 */
export async function executeTrade(input: ExecuteTradeInput): Promise<ExecuteTradeResult> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new TradeError("NOT_AUTHENTICATED");
  }

  const { data, error } = await supabase.rpc("execute_trade", {
    p_user_id: user.id,
    p_artist_id: input.artistId,
    p_side: input.side,
    p_amount: input.amount,
    p_min_receive: input.minReceive ?? 0,
  });

  if (error) {
    const code = mapDatabaseError(error.message);
    throw new TradeError(code);
  }

  return parseExecuteTradeResult(data);
}

/**
 * Normalizes the RPC's JSON payload into a typed `ExecuteTradeResult`. Postgres
 * `numeric` values can arrive as strings over the wire, so each numeric field
 * is coerced with `Number`.
 */
function parseExecuteTradeResult(data: unknown): ExecuteTradeResult {
  if (!data || typeof data !== "object") {
    throw new TradeError("UNKNOWN");
  }

  const row = data as Record<string, unknown>;

  return {
    tradeId: String(row.trade_id),
    side: row.side as TradeSide,
    shares: Number(row.shares),
    tokens: Number(row.tokens),
    pricePerShare: Number(row.price_per_share),
    marketPrice: Number(row.market_price),
    tokenBalance: Number(row.token_balance),
  };
}
