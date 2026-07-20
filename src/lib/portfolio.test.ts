import { describe, expect, it } from "vitest";
import { computePortfolioTotals, computePositionMetrics } from "./portfolio";

/**
 * These tests prove `computePositionMetrics` / `computePortfolioTotals`
 * reproduce the exact formulas implemented by `get_portfolio_summary`
 * (supabase/migrations/20260709120000_create_portfolio_summary_function.sql).
 *
 * The "SQL parity" block below asserts against values actually returned by
 * `select * from get_portfolio_summary(...)` in the database for a real user
 * with two open positions, a mix of buys/sells, and a signup bonus -- so we
 * know the TS math and the SQL math agree (to floating-point precision; the
 * tiny residual is Postgres `numeric` vs JS `number` representation, not a
 * formula mismatch -- see the very tight epsilon below).
 */

const CLOSE = 1e-6;

function expectClose(actual: number, expected: number, epsilon = CLOSE) {
  expect(Math.abs(actual - expected)).toBeLessThan(epsilon);
}

describe("computePositionMetrics", () => {
  it("computes current price, market value, average cost, and unrealized P/L", () => {
    const metrics = computePositionMetrics({
      shares: 10,
      totalCostBasis: 100,
      tokenReserve: 2000,
      shareReserve: 1000,
    });

    expect(metrics.currentPrice).toBe(2); // 2000 / 1000
    expect(metrics.marketValue).toBe(20); // 10 * 2
    expect(metrics.averageCost).toBe(10); // 100 / 10
    expect(metrics.unrealizedPl).toBe(-80); // 20 - 100
    expect(metrics.unrealizedPlPercent).toBe(-80); // -80 / 100 * 100
  });

  it("avoids dividing by zero when shares is 0", () => {
    const metrics = computePositionMetrics({
      shares: 0,
      totalCostBasis: 0,
      tokenReserve: 2000,
      shareReserve: 1000,
    });

    expect(metrics.averageCost).toBe(0);
    expect(metrics.marketValue).toBe(0);
    expect(metrics.unrealizedPlPercent).toBe(0);
  });
});

describe("computePortfolioTotals", () => {
  it("sums token balance and holdings value, then computes return % against total credited", () => {
    const totals = computePortfolioTotals({
      tokenBalance: 500,
      holdingsValue: 300,
      totalCredited: 1000,
    });

    expect(totals.totalValue).toBe(800); // 500 + 300
    expect(totals.returnPercent).toBe(-20); // (800 - 1000) / 1000 * 100
  });

  it("avoids dividing by zero when total credited is 0", () => {
    const totals = computePortfolioTotals({
      tokenBalance: 500,
      holdingsValue: 300,
      totalCredited: 0,
    });

    expect(totals.returnPercent).toBe(0);
  });
});

describe("SQL parity: get_portfolio_summary", () => {
  // Real holdings, from a live user with two open positions at test time.
  const rihanna = {
    shares: 235.15112676,
    totalCostBasis: 2000,
    tokenReserve: 8420137,
    shareReserve: 999764.84887324,
  };
  const radiohead = {
    shares: 0.23709731,
    totalCostBasis: 2,
    tokenReserve: 8351001.48859828,
    shareReserve: 999999.7629026900,
  };

  // From the same user's token_ledger: signup_bonus 10000, trade_buy -16002,
  // trade_sell +13721.51140172 -> balance 7719.51140172; total_credited is
  // just the signup_bonus (no stripe_purchase rows for this user).
  const tokenBalance = 7719.51140172;
  const totalCredited = 10000;

  it("matches get_portfolio_summary()'s holdings_value, total_value, and return_pct", () => {
    const holdingsValue =
      computePositionMetrics(rihanna).marketValue + computePositionMetrics(radiohead).marketValue;
    const totals = computePortfolioTotals({ tokenBalance, holdingsValue, totalCredited });

    // Values observed from `select * from get_portfolio_summary(...)` in the database:
    expectClose(holdingsValue, 1982.450413330873408110057694);
    expectClose(totals.totalValue, 9701.961815050873408110057694);
    expectClose(totals.returnPercent, -2.980381849491265918899400);
  });
});
