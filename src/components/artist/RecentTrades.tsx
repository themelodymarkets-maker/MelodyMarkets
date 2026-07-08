import { Card } from "@/components/ui/Card";
import { formatRelativeTime, formatTokenAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Trade } from "@/types/database";

interface RecentTradesProps {
  trades: Trade[];
}

/**
 * Server Component: the latest trade tape for an artist, already fetched and
 * ordered newest-first by the page (see `src/app/artist/[slug]/page.tsx`).
 * No trade execution exists in the app yet, so this table is empty for every
 * artist today -- the empty state below is the common case, not an edge case.
 */
export function RecentTrades({ trades }: RecentTradesProps) {
  return (
    <Card className="mt-6 overflow-hidden p-0">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-lg font-semibold text-foreground">Recent trades</h2>
      </div>

      {trades.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm font-medium text-foreground">No trades yet</p>
          <p className="mt-1 text-sm text-muted">
            Trade activity for this artist will show up here once trading unlocks.
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
        <span className="font-medium tabular-nums">{formatTokenAmount(Number(trade.shares))}</span>{" "}
        <span className="text-muted">shares @</span>{" "}
        <span className="font-medium tabular-nums">{formatTokenAmount(Number(trade.price_per_share))}</span>
      </span>

      <span className="shrink-0 text-xs text-muted">{formatRelativeTime(trade.created_at)}</span>
    </div>
  );
}
