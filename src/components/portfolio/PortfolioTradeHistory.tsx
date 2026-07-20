"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Num } from "@/components/ui/Num";
import { formatRelativeTime } from "@/lib/format";
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
 * the positions table; expanding it reveals the first page the server already
 * fetched, and Previous/Next page client-side via `.range()` on the `trades`
 * table (readable for the signed-in user's own rows).
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
        className="flex min-h-11 w-full items-center justify-between gap-4 px-6 py-4 text-left"
        aria-expanded={isOpen}
      >
        <span className="display-label text-sm text-foreground">
          Trade history
          {totalCount > 0 && (
            <span className="ml-2 font-data text-xs font-normal text-muted">{totalCount}</span>
          )}
        </span>
        <ChevronIcon isOpen={isOpen} />
      </button>

      {isOpen && (
        <div className="border-t border-border">
          {trades.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm text-foreground">No trades yet.</p>
              <p className="mt-1 text-sm text-muted">Your buys and sells show up here.</p>
            </div>
          ) : (
            <>
              <div className={cn("divide-y divide-rail", isLoading && "opacity-50")}>
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
                    className="min-h-11 display-label text-sm text-foreground disabled:cursor-not-allowed disabled:text-muted"
                  >
                    Previous
                  </button>
                  <span className="font-data text-xs text-muted">
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page + 1 >= totalPages || isLoading}
                    onClick={() => loadPage(page + 1)}
                    className="min-h-11 display-label text-sm text-foreground disabled:cursor-not-allowed disabled:text-muted"
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
  // Cash flow: a buy spends tokens (negative), a sell receives them (positive).
  const tokenFlow = isBuy ? -Number(trade.tokens) : Number(trade.tokens);

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

      <div className="min-w-0 flex-1">
        {trade.artists ? (
          <Link
            href={`/artist/${trade.artists.slug}`}
            className="block truncate text-sm font-medium text-foreground hover:underline"
            title={trade.artists.name}
          >
            {trade.artists.name}
          </Link>
        ) : (
          <span className="block truncate text-sm font-medium text-foreground">Unknown artist</span>
        )}
        <p className="mt-0.5 whitespace-nowrap text-xs text-muted">
          <Num value={Number(trade.shares)} variant="share" /> shares at{" "}
          <Num value={Number(trade.price_per_share)} variant="price" />
        </p>
      </div>

      <div className="shrink-0 text-right">
        <Num value={tokenFlow} variant="token" signed className="whitespace-nowrap text-sm text-foreground" />
        <p className="mt-0.5 whitespace-nowrap text-xs text-muted">
          {formatRelativeTime(trade.created_at)}
        </p>
      </div>
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
      className={cn("h-4 w-4 shrink-0 text-muted transition-transform", isOpen && "rotate-180")}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  );
}
