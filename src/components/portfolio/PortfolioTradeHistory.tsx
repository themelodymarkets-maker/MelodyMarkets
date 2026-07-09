"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { formatRelativeTime, formatShares, formatTokenAmount } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { PortfolioTradeRow } from "./types";

/** Trades per page. Small enough that a page loads instantly, large enough to rarely need paging. */
const PAGE_SIZE = 10;

interface PortfolioTradeHistoryProps {
  userId: string;
  /** Newest-first first page, fetched by the server for the first paint. */
  initialTrades: PortfolioTradeRow[];
  initialTotalCount: number;
}

/**
 * Client Component: a collapsible, paginated log of every trade the user has
 * ever placed, newest first. Collapsed by default so it doesn't compete with
 * the positions table for attention; expanding it lazily reveals the first
 * page the server already fetched, and "Previous"/"Next" page client-side
 * via `.range()` on the `trades` table (readable for the signed-in user's
 * own rows -- see `20260706190500_create_trades_table.sql`).
 */
export function PortfolioTradeHistory({
  userId,
  initialTrades,
  initialTotalCount,
}: PortfolioTradeHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [trades, setTrades] = useState(initialTrades);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [isLoading, setIsLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  async function loadPage(nextPage: number) {
    setIsLoading(true);
    const supabase = createClient();
    const from = nextPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, count, error } = await supabase
      .from("trades")
      .select("*, artists(name, slug)", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (!error) {
      setTrades((data ?? []) as PortfolioTradeRow[]);
      setTotalCount(count ?? 0);
      setPage(nextPage);
    }
    setIsLoading(false);
  }

  return (
    <Card className="mt-6 overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
        aria-expanded={isOpen}
      >
        <span className="text-lg font-semibold text-foreground">
          Trade history
          {totalCount > 0 && <span className="ml-2 text-sm font-normal text-muted">{totalCount}</span>}
        </span>
        <ChevronIcon isOpen={isOpen} />
      </button>

      {isOpen && (
        <div className="border-t border-border">
          {trades.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm font-medium text-foreground">No trades yet</p>
              <p className="mt-1 text-sm text-muted">Your buys and sells will show up here.</p>
            </div>
          ) : (
            <>
              <div className={cn("divide-y divide-border", isLoading && "opacity-50")}>
                {trades.map((trade) => (
                  <TradeHistoryRow key={trade.id} trade={trade} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-4 border-t border-border px-6 py-3">
                  <button
                    type="button"
                    disabled={page === 0 || isLoading}
                    onClick={() => loadPage(page - 1)}
                    className="text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:text-muted"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-muted">
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page + 1 >= totalPages || isLoading}
                    onClick={() => loadPage(page + 1)}
                    className="text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:text-muted"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}

function TradeHistoryRow({ trade }: { trade: PortfolioTradeRow }) {
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

      <div className="min-w-0 flex-1">
        {trade.artists ? (
          <Link
            href={`/artist/${trade.artists.slug}`}
            className="truncate font-medium text-foreground hover:underline"
          >
            {trade.artists.name}
          </Link>
        ) : (
          <span className="truncate font-medium text-foreground">Unknown artist</span>
        )}
        <p className="mt-0.5 text-xs text-muted tabular-nums">
          {formatShares(Number(trade.shares))} shares @ {formatTokenAmount(Number(trade.price_per_share))}
        </p>
      </div>

      <span className="shrink-0 text-right text-sm font-medium text-foreground tabular-nums">
        {isBuy ? "-" : "+"}
        {formatTokenAmount(Number(trade.tokens))}
      </span>

      <span className="shrink-0 text-xs text-muted">{formatRelativeTime(trade.created_at)}</span>
    </div>
  );
}

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={cn("h-4 w-4 shrink-0 text-muted transition-transform duration-200", isOpen && "rotate-180")}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  );
}
