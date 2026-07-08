/**
 * Shared display-formatting helpers for numbers that show up all over the
 * app: token amounts, large audience counts, and percentage price changes.
 * Centralizing them here means the markets page, artist detail, portfolio,
 * and leaderboards all format the same kind of value identically.
 */

const tokenAmountFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats a token amount/price with thousands separators, e.g. 8.4181 -> "8.42". */
export function formatTokenAmount(value: number): string {
  if (!Number.isFinite(value)) return "--";
  return tokenAmountFormatter.format(value);
}

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Formats a large count compactly, e.g. 12,412,000 -> "12.4M". Null-safe. */
export function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "--";
  }
  return compactNumberFormatter.format(value);
}

export type PriceDirection = "up" | "down" | "flat";

export interface PercentChange {
  /** Signed percent, e.g. 2.34 or -1.05. */
  percent: number;
  direction: PriceDirection;
}

/**
 * Computes the signed percent change from a baseline (`from`) to the current
 * value (`to`). Guards against a missing/non-positive baseline -- which
 * should not happen in practice (see the `get_market_overview` migration)
 * but would otherwise divide by zero -- by reporting a flat 0% instead.
 */
export function computePercentChange(from: number, to: number): PercentChange {
  if (!Number.isFinite(from) || from <= 0 || !Number.isFinite(to)) {
    return { percent: 0, direction: "flat" };
  }

  const percent = ((to - from) / from) * 100;
  const direction: PriceDirection = percent > 0 ? "up" : percent < 0 ? "down" : "flat";
  return { percent, direction };
}

/** Formats a signed percent for display, e.g. 2.339 -> "+2.34%", -1.05 -> "-1.05%". */
export function formatPercent(percent: number): string {
  if (!Number.isFinite(percent)) return "--";
  const sign = percent > 0 ? "+" : percent < 0 ? "-" : "";
  return `${sign}${Math.abs(percent).toFixed(2)}%`;
}
