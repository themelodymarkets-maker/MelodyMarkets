/**
 * The single source of truth for every number the app displays: token
 * amounts, prices, share counts, big audience counts, and percentages.
 * Nothing formats a number inline anymore. Prefer the <Num /> component
 * (src/components/ui/Num.tsx) so a value can never be formatted with the
 * wrong rule set by accident; these functions back it.
 *
 * Hard rules (see PART 2 of the redesign brief):
 *   compact:  < 1,000 as-is; 1K-999,999 -> "12.4K"; 1M-999,999,999 -> "12.4M";
 *             >= 1B -> "1.24B".
 *   token:    two decimals below 1,000; compact at/above 1,000. Never 8 dp.
 *   price:    two decimals below 1,000; compact above.
 *   share:    up to 4 decimals, trailing zeros stripped.
 *   percent:  always signed, always one decimal.
 */

const PLACEHOLDER = "--";

/** Rounds to `decimals` places then strips any trailing zeros (and dot). */
function trimTrailingZeros(value: number, decimals: number): string {
  return value
    .toFixed(decimals)
    .replace(/\.?0+$/, (match) => (match.includes(".") ? "" : match));
}

/**
 * Abbreviated magnitude: 12,400 -> "12.4K", 3,500,000 -> "3.5M",
 * 1,240,000,000 -> "1.24B". K/M keep one decimal, B keeps two, and trailing
 * zeros are stripped so 5,000 -> "5K".
 */
function abbreviate(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${sign}${trimTrailingZeros(abs / 1_000_000_000, 2)}B`;
  if (abs >= 1_000_000) return `${sign}${trimTrailingZeros(abs / 1_000_000, 1)}M`;
  if (abs >= 1_000) return `${sign}${trimTrailingZeros(abs / 1_000, 1)}K`;
  return `${sign}${abs}`;
}

const twoDecimal = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Compact large count, e.g. 12,412,000 -> "12.4M". Under 1,000 shows the
 * whole number with separators. Null-safe (renders "--").
 */
export function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return PLACEHOLDER;
  const abs = Math.abs(value);
  if (abs < 1000) return Math.round(value).toLocaleString("en-US");
  return abbreviate(value);
}

/**
 * Token amount: two decimals below 1,000 (e.g. 8.4181 -> "8.42"), compact
 * at/above 1,000 (e.g. 12,400 -> "12.4K"). Never shows the 8 decimal places
 * the database stores.
 */
export function formatTokenAmount(value: number): string {
  if (!Number.isFinite(value)) return PLACEHOLDER;
  if (Math.abs(value) < 1000) return twoDecimal.format(value);
  return abbreviate(value);
}

/**
 * Signed token delta with an explicit +/- sign, for unrealized P/L and other
 * values where the sign is the point: 12.345 -> "+12.35", -3 -> "-3.00",
 * 1_500_000 -> "+1.5M".
 */
export function formatSignedTokenAmount(value: number): string {
  if (!Number.isFinite(value)) return PLACEHOLDER;
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatTokenAmount(Math.abs(value))}`;
}

/** Price: same shape as a token amount (two decimals below 1,000, compact above). */
export function formatPrice(value: number): string {
  return formatTokenAmount(value);
}

const shareFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
});

/**
 * Share quantity: up to 4 decimals with trailing zeros stripped, e.g.
 * 30.2835828 -> "30.2836", 5 -> "5", 5.5 -> "5.5".
 */
export function formatShares(value: number): string {
  if (!Number.isFinite(value)) return PLACEHOLDER;
  if (Math.abs(value) >= 1_000_000) return abbreviate(value);
  return shareFormatter.format(value);
}

export type PriceDirection = "up" | "down" | "flat";

export interface PercentChange {
  /** Signed percent, e.g. 2.34 or -1.05. */
  percent: number;
  direction: PriceDirection;
}

/**
 * Signed percent change from a baseline (`from`) to the current value (`to`).
 * Guards against a missing/non-positive baseline (see `get_market_overview`)
 * by reporting a flat 0% instead of dividing by zero.
 */
export function computePercentChange(from: number, to: number): PercentChange {
  if (!Number.isFinite(from) || from <= 0 || !Number.isFinite(to)) {
    return { percent: 0, direction: "flat" };
  }

  const percent = ((to - from) / from) * 100;
  const direction: PriceDirection = percent > 0 ? "up" : percent < 0 ? "down" : "flat";
  return { percent, direction };
}

/** Whole-number count with thousands separators, e.g. 5000 -> "5,000". */
export function formatInteger(value: number): string {
  if (!Number.isFinite(value)) return PLACEHOLDER;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

/** Signed percent, one decimal: 2.339 -> "+2.3%", -1.05 -> "-1.1%", 0 -> "0.0%". */
export function formatPercent(percent: number): string {
  if (!Number.isFinite(percent)) return PLACEHOLDER;
  const sign = percent > 0 ? "+" : percent < 0 ? "-" : "";
  return `${sign}${Math.abs(percent).toFixed(1)}%`;
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
 * Short relative timestamp, e.g. "5 minutes ago" or "in 2 hours". Anything
 * under a minute (in either direction) reads as "just now".
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
