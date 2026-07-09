"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { computePortfolioTotals, computePositionMetrics } from "@/lib/portfolio";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database";
import { PortfolioEmptyState } from "./PortfolioEmptyState";
import { PortfolioPositionRow } from "./PortfolioPositionRow";
import { PortfolioPositionsListHeader } from "./PortfolioPositionsListHeader";
import { PortfolioSummaryHeader } from "./PortfolioSummaryHeader";
import { PortfolioTradeHistory } from "./PortfolioTradeHistory";
import type { PortfolioPositionData, PortfolioTradeRow } from "./types";

interface PortfolioViewProps {
  userId: string;
  positions: PortfolioPositionData[];
  /** Sum of the user's token_ledger rows, from `get_portfolio_summary()`. */
  tokenBalance: number;
  /** Sum of token_ledger rows credited via 'signup_bonus' or 'stripe_purchase'. */
  totalCredited: number;
  initialTrades: PortfolioTradeRow[];
  initialTradeCount: number;
}

/**
 * Client Component: owns every number on the page that can move while the
 * user is looking at it.
 *
 * `tokenBalance` and `totalCredited` are a stable snapshot from
 * `get_portfolio_summary()` -- they only change on a new trade or token
 * grant, which already causes a fresh page load elsewhere in the app.
 * `holdings value`, and therefore `total portfolio value` and
 * `total return %`, move every time ANY held artist's price moves, so --
 * exactly like `MarketsExplorer` -- this component subscribes once to
 * Realtime UPDATEs on `public.markets` and patches the matching position's
 * reserves in place. Every derived number (current price, market value, P/L,
 * total value, return %) is recomputed from `src/lib/portfolio.ts`, which
 * documents why its formulas are required to match
 * `get_portfolio_summary()` exactly -- that migration is the single place
 * these definitions are allowed to live; this file only re-evaluates them
 * for a live UI.
 */
export function PortfolioView({
  userId,
  positions: initialPositions,
  tokenBalance,
  totalCredited,
  initialTrades,
  initialTradeCount,
}: PortfolioViewProps) {
  const [positions, setPositions] = useState(initialPositions);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("portfolio-markets")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "markets" },
        (payload) => {
          const updatedMarket = payload.new as Tables<"markets">;

          setPositions((current) =>
            current.map((position) =>
              position.artistId === updatedMarket.artist_id
                ? {
                    ...position,
                    tokenReserve: Number(updatedMarket.token_reserve),
                    shareReserve: Number(updatedMarket.share_reserve),
                  }
                : position,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const holdingsValue = useMemo(
    () => positions.reduce((sum, position) => sum + computePositionMetrics(position).marketValue, 0),
    [positions],
  );

  const { totalValue, returnPercent } = computePortfolioTotals({
    tokenBalance,
    holdingsValue,
    totalCredited,
  });

  return (
    <div>
      <PortfolioSummaryHeader
        totalValue={totalValue}
        returnPercent={returnPercent}
        tokenBalance={tokenBalance}
      />

      {positions.length === 0 ? (
        <div className="mt-6">
          <PortfolioEmptyState />
        </div>
      ) : (
        <Card className="mt-6 overflow-hidden p-0">
          <PortfolioPositionsListHeader />
          <div className="divide-y divide-border">
            {positions.map((position) => (
              <PortfolioPositionRow key={position.artistId} position={position} />
            ))}
          </div>
        </Card>
      )}

      <PortfolioTradeHistory
        userId={userId}
        initialTrades={initialTrades}
        initialTotalCount={initialTradeCount}
      />
    </div>
  );
}
