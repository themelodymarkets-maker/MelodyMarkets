import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * The only ranges the price chart's tabs offer. Kept lower-case since these
 * double as the `?range=` query value the price-history API route accepts.
 */
export const PRICE_HISTORY_RANGES = ["1d", "1w", "1m", "all"] as const;
export type PriceHistoryRange = (typeof PRICE_HISTORY_RANGES)[number];

export function isPriceHistoryRange(value: string | null): value is PriceHistoryRange {
  return value !== null && (PRICE_HISTORY_RANGES as readonly string[]).includes(value);
}

/** Display labels for the range tabs, in the order they should render. */
export const PRICE_HISTORY_RANGE_LABELS: Record<PriceHistoryRange, string> = {
  "1d": "1D",
  "1w": "1W",
  "1m": "1M",
  all: "All",
};

/**
 * A single real `price_snapshots` row, trimmed to exactly what the chart
 * needs. Every `PricePoint` the app ever renders traces back to a real row in
 * that table -- see the "Price history & charts" section of ARCHITECTURE.md.
 */
export interface PricePoint {
  price: number;
  createdAt: string;
}

/** Never return more than this many points from a single range fetch. */
const MAX_POINTS = 500;

const RANGE_WINDOW_MS: Record<Exclude<PriceHistoryRange, "all">, number> = {
  "1d": 24 * 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
  "1m": 30 * 24 * 60 * 60 * 1000,
};

/** Start of the requested range's window, or `null` for "all" (no lower bound). */
function rangeStartDate(range: PriceHistoryRange, now: Date = new Date()): Date | null {
  if (range === "all") return null;
  return new Date(now.getTime() - RANGE_WINDOW_MS[range]);
}

/**
 * Buckets real rows by time and keeps only the *last* (most recent) row in
 * each bucket. This is aggregation of rows that genuinely exist -- never an
 * average, an interpolation, or a fabricated point -- so a downsampled series
 * still only ever shows prices that were actually recorded.
 *
 * `rows` must already be sorted ascending by time. Bucket boundaries are
 * evenly spaced across the row's actual time span, and a `Map` is used so
 * that re-`set`ing an existing bucket key updates its value in place without
 * moving it in iteration order -- keeping the output ascending too.
 */
export function downsamplePriceHistory(rows: PricePoint[], maxPoints = MAX_POINTS): PricePoint[] {
  if (rows.length <= maxPoints) return rows;

  const firstMs = new Date(rows[0].createdAt).getTime();
  const lastMs = new Date(rows[rows.length - 1].createdAt).getTime();
  const bucketMs = Math.max(1, Math.ceil((lastMs - firstMs + 1) / maxPoints));

  const buckets = new Map<number, PricePoint>();
  for (const row of rows) {
    const bucketIndex = Math.floor((new Date(row.createdAt).getTime() - firstMs) / bucketMs);
    buckets.set(bucketIndex, row);
  }

  return Array.from(buckets.values());
}

/**
 * Fetches the real `price_snapshots` history for one artist within a range,
 * downsampling only if the range holds more than `MAX_POINTS` real rows.
 *
 * Works with any Supabase client (anon/authenticated server client for user
 * requests, or the service-role admin client), since `price_snapshots` has a
 * public read policy -- see its migration.
 */
export async function fetchPriceHistory(
  supabase: SupabaseClient<Database>,
  artistId: string,
  range: PriceHistoryRange,
): Promise<PricePoint[]> {
  const windowStart = rangeStartDate(range);

  let query = supabase
    .from("price_snapshots")
    .select("price, created_at")
    .eq("artist_id", artistId)
    .order("created_at", { ascending: true });

  if (windowStart) {
    query = query.gte("created_at", windowStart.toISOString());
  }

  const { data, error } = await query;
  if (error) throw error;

  const points: PricePoint[] = (data ?? []).map((row) => ({
    price: Number(row.price),
    createdAt: row.created_at,
  }));

  return downsamplePriceHistory(points);
}
