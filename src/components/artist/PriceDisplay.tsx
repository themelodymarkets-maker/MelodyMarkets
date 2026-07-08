"use client";

import { useEffect, useState } from "react";
import { PriceChangePill } from "@/components/ui/PriceChangePill";
import { formatTokenAmount } from "@/lib/format";
import { computeSpotPrice, get24hPriceChange } from "@/lib/market";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database";

interface PriceDisplayProps {
  artistId: string;
  initialPrice: number;
  /** 24h-ago (or oldest available) reference price; see `src/lib/market.ts`. */
  referencePrice: number | null;
}

/**
 * Client Component: the prominent current-price readout on the artist detail
 * page. Seeded with the price the server already fetched, then subscribes to
 * Realtime UPDATEs on this artist's own `markets` row (filtered by
 * `artist_id`, unlike the markets watchlist's unfiltered subscription) so it
 * keeps ticking without a page reload as trades move the market.
 */
export function PriceDisplay({ artistId, initialPrice, referencePrice }: PriceDisplayProps) {
  const [currentPrice, setCurrentPrice] = useState(initialPrice);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`artist-market-${artistId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "markets", filter: `artist_id=eq.${artistId}` },
        (payload) => {
          const updatedMarket = payload.new as Tables<"markets">;
          setCurrentPrice(computeSpotPrice(updatedMarket));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [artistId]);

  const { percent } = get24hPriceChange({ currentPrice, referencePrice });

  return (
    <div className="flex flex-wrap items-end gap-3">
      <span className="text-4xl font-semibold text-foreground tabular-nums sm:text-5xl">
        {formatTokenAmount(currentPrice)}
        <span className="ml-2 text-base font-normal text-muted">tokens / share</span>
      </span>
      <PriceChangePill percent={percent} className="mb-2" />
    </div>
  );
}
