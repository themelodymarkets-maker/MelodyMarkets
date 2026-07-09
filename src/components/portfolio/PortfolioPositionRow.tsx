"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PriceChangePill } from "@/components/ui/PriceChangePill";
import { formatShares, formatSignedTokenAmount, formatTokenAmount } from "@/lib/format";
import { computePositionMetrics } from "@/lib/portfolio";
import { cn } from "@/lib/utils";
import { POSITION_COLUMN_WIDTHS } from "./columns";
import type { PortfolioPositionData } from "./types";

/** How long the green/red background flash lingers after a price update. */
const FLASH_DURATION_MS = 1000;

interface PortfolioPositionRowProps {
  position: PortfolioPositionData;
}

/**
 * Client Component: a single position row. Derives every displayed number
 * (current price, average cost, market value, unrealized P/L) from
 * `computePositionMetrics` -- see `src/lib/portfolio.ts` for why that must
 * match `get_portfolio_summary()`'s SQL exactly. `PortfolioView` patches
 * this row's `tokenReserve`/`shareReserve` whenever the shared markets
 * Realtime subscription reports a change for this artist, which is what
 * makes the row "live" -- this component then just detects its own price
 * changing (via a ref) to trigger a brief flash, same pattern as `MarketRow`.
 */
export function PortfolioPositionRow({ position }: PortfolioPositionRowProps) {
  const metrics = computePositionMetrics(position);

  const previousPriceRef = useRef(metrics.currentPrice);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    const previousPrice = previousPriceRef.current;
    previousPriceRef.current = metrics.currentPrice;

    if (metrics.currentPrice === previousPrice) return;

    setFlash(metrics.currentPrice > previousPrice ? "up" : "down");
    const timeoutId = setTimeout(() => setFlash(null), FLASH_DURATION_MS);
    return () => clearTimeout(timeoutId);
  }, [metrics.currentPrice]);

  const isGain = metrics.unrealizedPl >= 0;

  return (
    <Link
      href={`/artist/${position.slug}`}
      className={cn(
        "flex items-center gap-4 px-4 py-3 transition-colors duration-700 sm:px-6",
        "hover:bg-surface-hover",
        flash === "up" && "bg-gain/10",
        flash === "down" && "bg-loss/10",
      )}
    >
      <PositionAvatar name={position.name} imageUrl={position.imageUrl} />

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{position.name}</p>
        <p className="mt-0.5 text-xs text-muted tabular-nums">{formatShares(position.shares)} shares</p>
      </div>

      <span
        className={cn(
          POSITION_COLUMN_WIDTHS.avgCost,
          "hidden shrink-0 text-right text-sm text-muted tabular-nums sm:block",
        )}
      >
        {formatTokenAmount(metrics.averageCost)}
      </span>

      <span
        className={cn(
          POSITION_COLUMN_WIDTHS.price,
          "hidden shrink-0 text-right text-sm font-medium text-foreground tabular-nums sm:block",
        )}
      >
        {formatTokenAmount(metrics.currentPrice)}
      </span>

      <span
        className={cn(
          POSITION_COLUMN_WIDTHS.marketValue,
          "shrink-0 text-right text-sm font-semibold text-foreground tabular-nums",
        )}
      >
        {formatTokenAmount(metrics.marketValue)}
      </span>

      <span className={cn(POSITION_COLUMN_WIDTHS.pl, "flex shrink-0 flex-col items-end gap-1")}>
        <span className={cn("text-sm font-semibold tabular-nums", isGain ? "text-gain" : "text-loss")}>
          {formatSignedTokenAmount(metrics.unrealizedPl)}
        </span>
        <PriceChangePill percent={metrics.unrealizedPlPercent} />
      </span>
    </Link>
  );
}

function PositionAvatar({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  if (!imageUrl) {
    return (
      <span
        className={cn(
          POSITION_COLUMN_WIDTHS.avatar,
          "flex shrink-0 items-center justify-center rounded-full bg-accent-gradient text-sm font-semibold text-white",
        )}
        aria-hidden="true"
      >
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    // Same rationale as MarketRow's ArtistAvatar: artist art comes from an
    // arbitrary, growing set of CDN hosts, so a plain <img> is used instead
    // of next/image.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt=""
      width={44}
      height={44}
      className={cn(POSITION_COLUMN_WIDTHS.avatar, "shrink-0 rounded-full object-cover")}
    />
  );
}
