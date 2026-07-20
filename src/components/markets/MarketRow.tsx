"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PriceChangePill } from "@/components/ui/PriceChangePill";
import { Num } from "@/components/ui/Num";
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
 * A single watchlist row. Interactive (the whole row links to the artist) and
 * it detects its own price changes (via a ref holding the previous price) to
 * flash gain/loss briefly. Below 640px it renders as a card so the artist
 * name gets its own line and never gets clipped; at 640px and up it is a
 * fixed-column table row.
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
        "block px-4 py-3 transition-colors duration-700 hover:bg-border sm:px-6",
        flash === "up" && "bg-gain/10",
        flash === "down" && "bg-loss/10",
      )}
    >
      {/* Mobile card: name on its own line, numbers on the line below. */}
      <div className="sm:hidden">
        <div className="flex items-center gap-3">
          <ArtistAvatar name={row.name} imageUrl={row.imageUrl} />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-medium text-foreground">{row.name}</p>
            {row.genre && (
              <span className="mt-1 inline-block rounded-control border border-border px-2 py-0.5 display-label text-2xs text-muted">
                {row.genre}
              </span>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 pl-14">
          <span className="whitespace-nowrap text-xs text-muted">
            <Num value={row.listeners} variant="count" /> listeners
          </span>
          <div className="flex items-center gap-3 whitespace-nowrap">
            <Num value={row.currentPrice} variant="price" className="text-sm text-foreground" />
            <PriceChangePill percent={percent} />
          </div>
        </div>
      </div>

      {/* Desktop table row: fixed number columns, name column flexes + truncates. */}
      <div className="hidden items-center gap-4 sm:flex">
        <ArtistAvatar name={row.name} imageUrl={row.imageUrl} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground" title={row.name}>
            {row.name}
          </p>
          {row.genre && (
            <span className="mt-1 inline-block rounded-control border border-border px-2 py-0.5 display-label text-2xs text-muted">
              {row.genre}
            </span>
          )}
        </div>

        <span className={cn(MARKET_COLUMN_WIDTHS.listeners, "shrink-0 whitespace-nowrap text-right")}>
          <Num value={row.listeners} variant="count" className="text-sm text-muted" />
        </span>

        <span className={cn(MARKET_COLUMN_WIDTHS.sparkline, "flex shrink-0 justify-end")}>
          <Sparkline prices={row.sparkline} />
        </span>

        <span className={cn(MARKET_COLUMN_WIDTHS.price, "shrink-0 whitespace-nowrap text-right")}>
          <Num value={row.currentPrice} variant="price" className="text-sm text-foreground" />
        </span>

        <span className={cn(MARKET_COLUMN_WIDTHS.change, "flex shrink-0 justify-end whitespace-nowrap")}>
          <PriceChangePill percent={percent} />
        </span>
      </div>
    </Link>
  );
}

function ArtistAvatar({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  if (!imageUrl) {
    return (
      <span
        className={cn(
          MARKET_COLUMN_WIDTHS.avatar,
          "flex shrink-0 items-center justify-center rounded-full bg-border text-sm font-bold text-foreground",
        )}
        aria-hidden="true"
      >
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    // Artist art comes from Last.fm/dicebear CDNs decided at ingestion time
    // (see src/lib/lastfm.ts): an arbitrary, growing set of hosts not worth
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
