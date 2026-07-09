import { NextResponse } from "next/server";
import {
  fetchPriceHistory,
  isPriceHistoryRange,
  type PriceHistoryRange,
  type PricePoint,
} from "@/lib/price-history";
import { createClient } from "@/lib/supabase/server";

interface PriceHistoryResponse {
  range: PriceHistoryRange;
  points: PricePoint[];
}

/**
 * GET /api/artists/:artistId/price-history?range=1d|1w|1m|all
 *
 * On-demand range fetch for `PriceChart`: the artist page only fetches the
 * chart's default range server-side, and calls here for every other range
 * tab the user selects. Read-only and public -- `price_snapshots` already has
 * an `anon` read policy (see its migration) -- so this uses the regular
 * cookie-scoped server client rather than the service-role client.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ artistId: string }> },
) {
  const { artistId } = await params;
  const url = new URL(request.url);
  const rangeParam = url.searchParams.get("range");
  const range: PriceHistoryRange = isPriceHistoryRange(rangeParam) ? rangeParam : "1d";

  try {
    const supabase = await createClient();
    const points = await fetchPriceHistory(supabase, artistId, range);
    return NextResponse.json({ range, points } satisfies PriceHistoryResponse);
  } catch (error) {
    console.error(`[api/artists/${artistId}/price-history] failed:`, error);
    return NextResponse.json({ error: "Failed to load price history." }, { status: 500 });
  }
}
