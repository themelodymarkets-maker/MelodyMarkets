"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { PriceChangePill } from "@/components/ui/PriceChangePill";
import { Num } from "@/components/ui/Num";
import { Explain } from "@/components/ui/Explain";
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
 * A single position. Derives every displayed number (current price, average
 * cost, market value, unrealized P/L) from `computePositionMetrics` (see
 * `src/lib/portfolio.ts` for why that must match `get_portfolio_summary()`).
 * `PortfolioView` patches this row's reserves whenever the shared markets
 * subscription reports a change for this artist; this component then flashes
 * on its own price change, same pattern as `MarketRow`. Below 640px it is a
 * stacked card; at 640px and up it is a fixed-column table row.
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
        "block px-4 py-3 transition-colors duration-700 hover:bg-border sm:px-6",
        flash === "up" && "bg-gain/10",
        flash === "down" && "bg-loss/10",
      )}
    >
      {/* Mobile stacked card. */}
      <div className="sm:hidden">
        <div className="flex items-center gap-3">
          <PositionAvatar name={position.name} imageUrl={position.imageUrl} />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-medium text-foreground">{position.name}</p>
            <p className="mt-0.5 text-xs text-muted">
              <Num value={position.shares} variant="share" /> shares
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 text-right text-sm",
              isGain ? "text-gain text-glow-gain" : "text-loss text-glow-loss",
            )}
          >
            <Num value={metrics.unrealizedPl} variant="token" signed />
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 pl-14">
          <MobileStat label={<Explain term="cost basis">Avg cost</Explain>}>
            <Num value={metrics.averageCost} variant="price" className="text-foreground" />
          </MobileStat>
          <MobileStat label="Price">
            <Num value={metrics.currentPrice} variant="price" className="text-foreground" />
          </MobileStat>
          <MobileStat label="Value">
            <Num value={metrics.marketValue} variant="token" className="text-foreground" />
          </MobileStat>
        </div>
      </div>

      {/* Desktop table row. */}
      <div className="hidden items-center gap-4 sm:flex">
        <PositionAvatar name={position.name} imageUrl={position.imageUrl} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground" title={position.name}>
            {position.name}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            <Num value={position.shares} variant="share" /> shares
          </p>
        </div>

        <span className={cn(POSITION_COLUMN_WIDTHS.avgCost, "shrink-0 whitespace-nowrap text-right")}>
          <Num value={metrics.averageCost} variant="price" className="text-sm text-muted" />
        </span>

        <span className={cn(POSITION_COLUMN_WIDTHS.price, "shrink-0 whitespace-nowrap text-right")}>
          <Num value={metrics.currentPrice} variant="price" className="text-sm text-foreground" />
        </span>

        <span className={cn(POSITION_COLUMN_WIDTHS.marketValue, "shrink-0 whitespace-nowrap text-right")}>
          <Num value={metrics.marketValue} variant="token" className="text-sm text-foreground" />
        </span>

        <span className={cn(POSITION_COLUMN_WIDTHS.pl, "flex shrink-0 flex-col items-end gap-1")}>
          <span
            className={cn(
              "whitespace-nowrap text-sm",
              isGain ? "text-gain text-glow-gain" : "text-loss text-glow-loss",
            )}
          >
            <Num value={metrics.unrealizedPl} variant="token" signed />
          </span>
          <PriceChangePill percent={metrics.unrealizedPlPercent} />
        </span>
      </div>
    </Link>
  );
}

function MobileStat({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="display-label text-2xs text-muted">{label}</p>
      <p className="mt-0.5 whitespace-nowrap text-sm">{children}</p>
    </div>
  );
}

function PositionAvatar({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  if (!imageUrl) {
    return (
      <span
        className={cn(
          POSITION_COLUMN_WIDTHS.avatar,
          "flex shrink-0 items-center justify-center rounded-full bg-border text-sm font-bold text-foreground",
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
