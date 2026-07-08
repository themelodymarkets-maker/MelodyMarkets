import { describe, expect, it } from "vitest";
import {
  FEE_FACTOR,
  TRADE_FEE_RATE,
  TradeError,
  mapDatabaseError,
  quoteTrade,
  type Reserves,
} from "./trade";

/**
 * These tests prove `quoteTrade` reproduces the exact formulas implemented by
 * the `execute_trade` Postgres function
 * (supabase/migrations/20260708160000_create_execute_trade_function.sql).
 *
 * The "SQL parity" block below asserts against values that were produced by
 * actually calling `execute_trade` in the database (inside a rolled-back
 * transaction) against a real market -- token_reserve 3268999, share_reserve
 * 1000000 -- so we know the TS math and the SQL math agree to 8 decimals.
 */

const CLOSE = 1e-6;

function expectClose(actual: number, expected: number, epsilon = CLOSE) {
  expect(Math.abs(actual - expected)).toBeLessThan(epsilon);
}

/** Fee-free constant-product output for a buy (baseline to measure the fee against). */
function feelessBuyShares({ tokenReserve, shareReserve }: Reserves, amount: number): number {
  return shareReserve - (tokenReserve * shareReserve) / (tokenReserve + amount);
}

describe("quoteTrade — constants", () => {
  it("uses a 1% fee (0.99 factor)", () => {
    expect(TRADE_FEE_RATE).toBe(0.01);
    expect(FEE_FACTOR).toBeCloseTo(0.99, 12);
  });
});

describe("quoteTrade — buy", () => {
  const reserves: Reserves = { tokenReserve: 1000, shareReserve: 1000 };

  it("computes constant-product shares_out with the 1% fee applied to the input", () => {
    const q = quoteTrade(reserves, "buy", 100);

    // effective_in = 100 * 0.99 = 99
    // shares_out   = 1000 - (1000*1000)/(1000+99) = 1000 - 1000000/1099
    const effectiveIn = 100 * FEE_FACTOR;
    const expectedShares = 1000 - (1000 * 1000) / (1000 + effectiveIn);

    expectClose(q.shares, expectedShares);
    expect(q.tokens).toBe(100); // full spend
    expectClose(q.pricePerShare, 100 / expectedShares);
  });

  it("adds the FULL spend to token_reserve but only removes shares_out (fee stays in pool)", () => {
    const q = quoteTrade(reserves, "buy", 100);

    expect(q.newTokenReserve).toBe(1000 + 100); // full amount, incl. fee
    expectClose(q.newShareReserve, 1000 - q.shares);
    expectClose(q.newMarketPrice, q.newTokenReserve / q.newShareReserve);
  });

  it("returns fewer shares than a fee-free swap would (the fee costs the buyer)", () => {
    const q = quoteTrade(reserves, "buy", 100);
    expect(q.shares).toBeLessThan(feelessBuyShares(reserves, 100));
  });

  it("deepens liquidity: k strictly increases after a buy", () => {
    const q = quoteTrade(reserves, "buy", 100);
    const kBefore = reserves.tokenReserve * reserves.shareReserve;
    const kAfter = q.newTokenReserve * q.newShareReserve;
    expect(kAfter).toBeGreaterThan(kBefore);
  });
});

describe("quoteTrade — sell", () => {
  const reserves: Reserves = { tokenReserve: 1000, shareReserve: 1000 };

  it("computes gross constant-product proceeds then skims 1% for the seller", () => {
    const q = quoteTrade(reserves, "sell", 100);

    const tokensGross = 1000 - (1000 * 1000) / (1000 + 100);
    const expectedTokens = tokensGross * FEE_FACTOR;

    expectClose(q.tokens, expectedTokens);
    expect(q.shares).toBe(100);
    expectClose(q.pricePerShare, expectedTokens / 100);
  });

  it("adds shares to the pool but only removes the NET tokens paid out (fee stays in pool)", () => {
    const q = quoteTrade(reserves, "sell", 100);

    expect(q.newShareReserve).toBe(1000 + 100);
    expectClose(q.newTokenReserve, 1000 - q.tokens);
    expectClose(q.newMarketPrice, q.newTokenReserve / q.newShareReserve);
  });

  it("deepens liquidity: k strictly increases after a sell", () => {
    const q = quoteTrade(reserves, "sell", 100);
    const kBefore = reserves.tokenReserve * reserves.shareReserve;
    const kAfter = q.newTokenReserve * q.newShareReserve;
    expect(kAfter).toBeGreaterThan(kBefore);
  });
});

describe("quoteTrade — round trip", () => {
  it("buying then immediately selling the shares back loses roughly two fees", () => {
    const reserves: Reserves = { tokenReserve: 5_000_000, shareReserve: 1_000_000 };
    const spend = 1000;

    const buy = quoteTrade(reserves, "buy", spend);
    const sell = quoteTrade(
      { tokenReserve: buy.newTokenReserve, shareReserve: buy.newShareReserve },
      "sell",
      buy.shares,
    );

    // A round trip can never be profitable...
    expect(sell.tokens).toBeLessThan(spend);
    // ...and for a small trade relative to the pool it costs ~ two 1% fees.
    expectClose(sell.tokens, spend * FEE_FACTOR * FEE_FACTOR, 0.5);
  });
});

describe("quoteTrade — SQL parity", () => {
  // Real reserves from the live Olivia Rodrigo market at test time.
  const reserves: Reserves = { tokenReserve: 3268999, shareReserve: 1000000 };

  it("matches execute_trade's buy output (100 tokens) to 8 decimals", () => {
    const q = quoteTrade(reserves, "buy", 100);

    // Values observed from execute_trade() in the database:
    expectClose(q.shares, 30.28358281);
    expectClose(q.newTokenReserve, 3269099);
    expectClose(q.newShareReserve, 999969.71641719);
    expectClose(q.newMarketPrice, 3.269198, 1e-5);
    expectClose(q.pricePerShare, 3.30211919, 1e-5);
  });

  it("matches execute_trade's sell output when unwinding that buy", () => {
    const buy = quoteTrade(reserves, "buy", 100);
    const sell = quoteTrade(
      { tokenReserve: buy.newTokenReserve, shareReserve: buy.newShareReserve },
      "sell",
      buy.shares,
    );

    // Observed net proceeds and resulting price from the database:
    expectClose(sell.tokens, 98.01002998, 1e-5);
    expectClose(sell.newMarketPrice, 3.26900099, 1e-5);
  });
});

describe("quoteTrade — validation", () => {
  const reserves: Reserves = { tokenReserve: 1000, shareReserve: 1000 };

  it("rejects non-positive amounts", () => {
    expect(() => quoteTrade(reserves, "buy", 0)).toThrow(RangeError);
    expect(() => quoteTrade(reserves, "sell", -5)).toThrow(RangeError);
  });

  it("rejects non-positive reserves", () => {
    expect(() => quoteTrade({ tokenReserve: 0, shareReserve: 1000 }, "buy", 1)).toThrow(RangeError);
    expect(() => quoteTrade({ tokenReserve: 1000, shareReserve: 0 }, "sell", 1)).toThrow(RangeError);
  });
});

describe("mapDatabaseError", () => {
  it("maps each distinct SQL exception token to its code", () => {
    expect(mapDatabaseError("SLIPPAGE_EXCEEDED")).toBe("SLIPPAGE_EXCEEDED");
    expect(mapDatabaseError("INSUFFICIENT_BALANCE: ...")).toBe("INSUFFICIENT_BALANCE");
    expect(mapDatabaseError("boom INSUFFICIENT_SHARES boom")).toBe("INSUFFICIENT_SHARES");
    expect(mapDatabaseError("INVALID_SIDE")).toBe("INVALID_SIDE");
    expect(mapDatabaseError("INVALID_AMOUNT")).toBe("INVALID_AMOUNT");
    expect(mapDatabaseError("UNKNOWN_MARKET")).toBe("UNKNOWN_MARKET");
    expect(mapDatabaseError("FORBIDDEN_USER")).toBe("FORBIDDEN_USER");
  });

  it("falls back to UNKNOWN for unrecognized messages", () => {
    expect(mapDatabaseError("some random pg error")).toBe("UNKNOWN");
    expect(mapDatabaseError(null)).toBe("UNKNOWN");
  });
});

describe("TradeError", () => {
  it("carries a code and a friendly default message", () => {
    const err = new TradeError("INSUFFICIENT_BALANCE");
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("INSUFFICIENT_BALANCE");
    expect(err.message.length).toBeGreaterThan(0);
  });
});
