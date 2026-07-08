"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { formatRelativeTime, formatShares, formatTokenAmount } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Tables, Trade } from "@/types/database";

interface RecentTradesProps {
  artistId: string;
  /** Newest-first trade tape fetched by the server for the first paint. */
  initialTrades: Trade[];
}

const MAX_ROWS = 20;

/**
 * Client Component: the artist's live trade tape. Seeded with the trades the
 * server already fetched (see `src/app/artist/[slug]/page.tsx`), then keeps
 * itself current by subscribing to Realtime INSERTs on `trades` for this
 * artist -- so a fill from anyone (this user or another) appears at the top
 * without a reload. New rows are de-duplicated against the seed/optimistic
 * updates by trade id.
 */
export function RecentTrades({ artistId, initialTrades }: RecentTradesProps) {
  const [trades, setTrades] = useState<Trade[]>(initialTrades);

  useEffect(() => {
    setTrades(initialTrades);
  }, [initialTrades]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`artist-trades-${artistId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "trades", filter: `artist_id=eq.${artistId}` },
        (payload) => {
          const inserted = payload.new as Tables<"trades">;
          setTrades((current) => {
            if (current.some((t) => t.id === inserted.id)) return current;
            return [inserted, ...current].slice(0, MAX_ROWS);
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [artistId]);

  return (
    <Card className="mt-6 overflow-hidden p-0">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-lg font-semibold text-foreground">Recent trades</h2>
      </div>

      {trades.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm font-medium text-foreground">No trades yet</p>
          <p className="mt-1 text-sm text-muted">
            Be the first to trade this artist — activity shows up here in real time.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {trades.map((trade) => (
            <TradeRow key={trade.id} trade={trade} />
          ))}
        </div>
      )}
    </Card>
  );
}

function TradeRow({ trade }: { trade: Trade }) {
  const isBuy = trade.side === "buy";

  return (
    <div className="flex items-center gap-4 px-6 py-3">
      <span
        className={cn(
          "w-14 shrink-0 rounded-full px-2.5 py-1 text-center text-xs font-semibold uppercase",
          isBuy ? "bg-gain/10 text-gain" : "bg-loss/10 text-loss",
        )}
      >
        {trade.side}
      </span>

      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
        <span className="font-medium tabular-nums">{formatShares(Number(trade.shares))}</span>{" "}
        <span className="text-muted">shares @</span>{" "}
        <span className="font-medium tabular-nums">{formatTokenAmount(Number(trade.price_per_share))}</span>
      </span>

      <span className="shrink-0 text-xs text-muted">{formatRelativeTime(trade.created_at)}</span>
    </div>
  );
}
