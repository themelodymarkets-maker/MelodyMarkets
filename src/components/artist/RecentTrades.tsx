"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Num } from "@/components/ui/Num";
import { formatRelativeTime } from "@/lib/format";
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
 * artist, so a fill from anyone (this user or another) appears at the top
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
        <h2 className="display-label text-sm text-foreground">Recent trades</h2>
      </div>

      {trades.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm text-foreground">No trades yet.</p>
          <p className="mt-1 text-sm text-muted">Buys and sells show up here in real time.</p>
        </div>
      ) : (
        <div className="divide-y divide-rail">
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
    <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
      <span
        className={cn(
          "flex w-12 shrink-0 items-center gap-1 display-label text-2xs",
          isBuy ? "text-foreground" : "text-muted",
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          className={cn("h-3 w-3", !isBuy && "rotate-180")}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M6 11l6-6 6 6" />
        </svg>
        {isBuy ? "Buy" : "Sell"}
      </span>

      <span className="min-w-0 flex-1 whitespace-nowrap text-sm text-muted">
        <Num value={Number(trade.shares)} variant="share" className="text-foreground" />
        <span className="mx-1">at</span>
        <Num value={Number(trade.price_per_share)} variant="price" className="text-foreground" />
      </span>

      <span className="shrink-0 whitespace-nowrap text-xs text-muted">
        {formatRelativeTime(trade.created_at)}
      </span>
    </div>
  );
}
