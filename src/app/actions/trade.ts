"use server";

import {
  executeTrade,
  TradeError,
  type ExecuteTradeResult,
  type TradeErrorCode,
  type TradeSide,
} from "@/lib/trade";

export interface SubmitTradeInput {
  artistId: string;
  side: TradeSide;
  /** Tokens to spend (buy) or shares to sell (sell). */
  amount: number;
  /** Minimum acceptable output; derived client-side from a quote + tolerance. */
  minReceive: number;
}

export type SubmitTradeResult =
  | { ok: true; result: ExecuteTradeResult }
  | { ok: false; code: TradeErrorCode; message: string };

/**
 * Server Action boundary for trading. The browser calls this instead of ever
 * touching the service role or the raw `execute_trade` RPC directly: it runs on
 * the server, resolves the signed-in user from cookies, and delegates to the
 * `executeTrade` wrapper (which calls the SECURITY DEFINER Postgres function as
 * that user). Typed failures are returned as data -- not thrown -- so the client
 * can render a friendly toast without crossing an error boundary.
 */
export async function submitTrade(input: SubmitTradeInput): Promise<SubmitTradeResult> {
  try {
    const result = await executeTrade({
      artistId: input.artistId,
      side: input.side,
      amount: input.amount,
      minReceive: input.minReceive,
    });
    return { ok: true, result };
  } catch (error) {
    if (error instanceof TradeError) {
      return { ok: false, code: error.code, message: error.message };
    }
    return {
      ok: false,
      code: "UNKNOWN",
      message: "Something went wrong while placing your trade. Please try again.",
    };
  }
}
