"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PriceChangePill } from "@/components/ui/PriceChangePill";
import { formatCompactNumber, formatTokenAmount } from "@/lib/format";
import { get24hPriceChange } from "@/lib/market";
import { cn } from "@/lib/utils";
import { MARKET_COLUMN_WIDTHS } from "./columns";
import { Sparkline } from "./Sparkline";
import type { MarketRowData } from "./types";

/** How long the green/red background flash lingers after a price update. */
const FLASH_DURATION_MS = 1000;

interface MarketRowProps {
  row: MarketRowData;
}

/**
 * Client Component: a single watchlist row. Needs to be a Client Component
 * for two reasons -- it's interactive (the whole row is a link) and it
 * detects its own price changes (via a ref holding the previous price) to
 * trigger a brief flash, independent of *why* the price changed (initial
 * realtime patch from `MarketsExplorer`, or otherwise).
 */
export function MarketRow({ row }: MarketRowProps) {
  const previousPriceRef = useRef(row.currentPrice);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    const previousPrice = previousPriceRef.current;
    previousPriceRef.current = row.currentPrice;

    if (row.currentPrice === previousPrice) return;

    setFlash(row.currentPrice > previousPrice ? "up" : "down");
    const timeoutId = setTimeout(() => setFlash(null), FLASH_DURATION_MS);
    return () => clearTimeout(timeoutId);
  }, [row.currentPrice]);

  const { percent } = get24hPriceChange(row);

  return (
    <Link
      href={`/artist/${row.slug}`}
      className={cn(
        "flex items-center gap-4 px-4 py-3 transition-colors duration-700 sm:px-6",
        "hover:bg-surface-hover",
        flash === "up" && "bg-gain/10",
        flash === "down" && "bg-loss/10",
      )}
    >
      <ArtistAvatar name={row.name} imageUrl={row.imageUrl} />

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{row.name}</p>
        {row.genre && (
          <span className="mt-1 inline-block rounded-full border border-border px-2 py-0.5 text-[11px] font-medium tracking-wide text-muted uppercase">
            {row.genre}
          </span>
        )}
      </div>

      <span
        className={cn(
          MARKET_COLUMN_WIDTHS.listeners,
          "hidden shrink-0 text-right text-sm text-muted sm:block",
        )}
      >
        {formatCompactNumber(row.listeners)}
      </span>

      <span
        className={cn(MARKET_COLUMN_WIDTHS.sparkline, "hidden shrink-0 justify-end sm:flex")}
      >
        <Sparkline prices={row.sparkline} />
      </span>

      <span
        className={cn(
          MARKET_COLUMN_WIDTHS.price,
          "shrink-0 text-right font-semibold text-foreground tabular-nums",
        )}
      >
        {formatTokenAmount(row.currentPrice)}
      </span>

      <span className={cn(MARKET_COLUMN_WIDTHS.change, "flex shrink-0 justify-end")}>
        <PriceChangePill percent={percent} />
      </span>
    </Link>
  );
}

function ArtistAvatar({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  if (!imageUrl) {
    return (
      <span
        className={cn(
          MARKET_COLUMN_WIDTHS.avatar,
          "flex shrink-0 items-center justify-center rounded-full bg-accent-gradient text-sm font-semibold text-white",
        )}
        aria-hidden="true"
      >
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    // Artist art comes from Last.fm/dicebear CDNs decided at ingestion time
    // (see src/lib/lastfm.ts) -- an arbitrary, growing set of hosts not worth
    // hardcoding into next.config's image allowlist, so a plain <img> is used
    // instead of next/image here.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt=""
      width={44}
      height={44}
      className={cn(MARKET_COLUMN_WIDTHS.avatar, "shrink-0 rounded-full object-cover")}
    />
  );
}
