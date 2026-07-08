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

const shareAmountFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

/**
 * Formats a share quantity with up to 4 decimals (shares are fractional in the
 * AMM), e.g. 30.2835828 -> "30.2836". Falls back to "--" for non-finite input.
 */
export function formatShares(value: number): string {
  if (!Number.isFinite(value)) return "--";
  return shareAmountFormatter.format(value);
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

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

/** Largest-to-smallest units `formatRelativeTime` checks, each with its length in milliseconds. */
const RELATIVE_TIME_UNITS: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
  { unit: "year", ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: "month", ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: "day", ms: 24 * 60 * 60 * 1000 },
  { unit: "hour", ms: 60 * 60 * 1000 },
  { unit: "minute", ms: 60 * 1000 },
];

/**
 * Formats an ISO timestamp as a short relative string, e.g. "5 minutes ago"
 * or "in 2 hours". Anything under a minute (in either direction) reads as
 * "just now" rather than "0 minutes ago".
 */
export function formatRelativeTime(isoTimestamp: string): string {
  const diffMs = new Date(isoTimestamp).getTime() - Date.now();

  for (const { unit, ms } of RELATIVE_TIME_UNITS) {
    if (Math.abs(diffMs) >= ms) {
      return relativeTimeFormatter.format(Math.round(diffMs / ms), unit);
    }
  }

  return "just now";
}
