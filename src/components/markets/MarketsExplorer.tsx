"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { computeSpotPrice, get24hPriceChange } from "@/lib/market";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database";
import { cn } from "@/lib/utils";
import { MarketRow } from "./MarketRow";
import { MarketsEmptyState } from "./MarketsEmptyState";
import { MarketsListHeader } from "./MarketsListHeader";
import { MarketsToolbar } from "./MarketsToolbar";
import type { MarketRowData, SortDirection, SortField } from "./types";

interface MarketsExplorerProps {
  initialRows: MarketRowData[];
}

/**
 * Client Component: owns everything on the markets page that needs browser
 * state -- search, sort, and the live Supabase Realtime subscription. Seeded
 * with the rows the server already fetched (`initialRows`), so there is no
 * client-side data fetch (and no loading flash) for the first paint; from
 * then on this component patches individual rows in place as trades move
 * their price, rather than ever refetching the whole list.
 */
export function MarketsExplorer({ initialRows }: MarketsExplorerProps) {
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("popularity");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [isLive, setIsLive] = useState(false);

  // Subscribe once to Realtime changes on `markets`. Each UPDATE payload
  // (fired whenever a trade moves token_reserve/share_reserve) patches only
  // the matching row's price -- the rest of the list, and the current
  // search/sort state, are left completely untouched.
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("markets-watchlist")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "markets" },
        (payload) => {
          const updatedMarket = payload.new as Tables<"markets">;
          const nextPrice = computeSpotPrice(updatedMarket);

          setRows((currentRows) =>
            currentRows.map((row) =>
              row.artistId === updatedMarket.artist_id ? { ...row, currentPrice: nextPrice } : row,
            ),
          );
        },
      )
      .subscribe((status) => setIsLive(status === "SUBSCRIBED"));

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  function handleSortChange(field: SortField) {
    if (field === sortField) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  }

  const visibleRows = useMemo(
    () => filterAndSortRows(rows, query, sortField, sortDirection),
    [rows, query, sortField, sortDirection],
  );

  return (
    <div>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Markets</h1>
          <p className="mt-1 text-sm text-muted">
            Live prices across {rows.length} active artist{rows.length === 1 ? "" : "s"}.
          </p>
        </div>
        <LiveIndicator isLive={isLive} />
      </header>

      {rows.length === 0 ? (
        <div className="mt-8">
          <MarketsEmptyState
            title="No markets yet"
            description="Check back soon — artists are added to MelodyMarkets regularly."
          />
        </div>
      ) : (
        <>
          <div className="mt-6">
            <MarketsToolbar
              query={query}
              onQueryChange={setQuery}
              sortField={sortField}
              sortDirection={sortDirection}
              onSortChange={handleSortChange}
            />
          </div>

          <Card className="mt-6 overflow-hidden p-0">
            <MarketsListHeader />
            {visibleRows.length === 0 ? (
              <div className="p-6">
                <MarketsEmptyState
                  title="No matches"
                  description={`No artists match "${query}". Try a different search.`}
                />
              </div>
            ) : (
              <div className="divide-y divide-border">
                {visibleRows.map((row) => (
                  <MarketRow key={row.artistId} row={row} />
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function filterAndSortRows(
  rows: MarketRowData[],
  query: string,
  sortField: SortField,
  sortDirection: SortDirection,
): MarketRowData[] {
  const trimmedQuery = query.trim().toLowerCase();
  const filtered = trimmedQuery
    ? rows.filter((row) => row.name.toLowerCase().includes(trimmedQuery))
    : rows;

  const sorted = [...filtered].sort((a, b) => {
    const diff = getSortValue(a, sortField) - getSortValue(b, sortField);
    return sortDirection === "asc" ? diff : -diff;
  });

  return sorted;
}

function getSortValue(row: MarketRowData, field: SortField): number {
  switch (field) {
    case "price":
      return row.currentPrice;
    case "change":
      return get24hPriceChange(row).percent;
    case "popularity":
      return row.listeners ?? 0;
  }
}

function LiveIndicator({ isLive }: { isLive: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
      <span
        className={cn("h-1.5 w-1.5 rounded-full", isLive ? "bg-gain" : "bg-muted")}
        aria-hidden="true"
      />
      {isLive ? "Live" : "Connecting…"}
    </span>
  );
}
