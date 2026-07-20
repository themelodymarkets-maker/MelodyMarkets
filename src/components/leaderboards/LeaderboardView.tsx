"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { fetchLeaderboardBoard, fetchLeaderboardStats } from "@/lib/leaderboard";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { LeaderboardRow } from "./LeaderboardRow";
import { LeaderboardStatsRow } from "./LeaderboardStats";
import type { LeaderboardBoard, LeaderboardKind, LeaderboardStats } from "./types";

/**
 * At most one refetch per this window. Every trade INSERT arriving over
 * Realtime schedules a single trailing refetch, and further inserts within the
 * window collapse into that same pending run, so a burst of trades costs one
 * refresh, not one per trade, while still updating within a few seconds.
 */
const REFRESH_INTERVAL_MS = 4000;

interface LeaderboardViewProps {
  /** The signed-in user's id, or null for a public (logged-out) viewer. */
  currentUserId: string | null;
  initialBoards: Record<LeaderboardKind, LeaderboardBoard>;
  initialStats: LeaderboardStats;
}

const TABS: Array<{ kind: LeaderboardKind; label: string }> = [
  { kind: "return", label: "Top returns" },
  { kind: "value", label: "Biggest portfolios" },
];

/**
 * Client Component that owns the leaderboards page's browser state: the active
 * tab, the live Realtime subscription, and the debounced refetch. Seeded with
 * both boards + stats the server already fetched, so there's no loading flash
 * on first paint; from then on it refetches (throttled) whenever any trade is
 * inserted, so every connected viewer sees rank changes within moments.
 */
export function LeaderboardView({
  currentUserId,
  initialBoards,
  initialStats,
}: LeaderboardViewProps) {
  const [boards, setBoards] = useState(initialBoards);
  const [stats, setStats] = useState(initialStats);
  const [activeTab, setActiveTab] = useState<LeaderboardKind>("return");
  const [isLive, setIsLive] = useState(false);

  const isAuthenticated = currentUserId !== null;

  // Throttle bookkeeping for the trailing-edge refetch (see REFRESH_INTERVAL_MS).
  const lastRunRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    try {
      const [returnBoard, valueBoard, nextStats] = await Promise.all([
        fetchLeaderboardBoard(supabase, "return", isAuthenticated),
        fetchLeaderboardBoard(supabase, "value", isAuthenticated),
        fetchLeaderboardStats(supabase),
      ]);
      setBoards({ return: returnBoard, value: valueBoard });
      setStats(nextStats);
    } catch (error) {
      // A failed live refresh is non-fatal: keep showing the last good board
      // rather than tearing the page down. The next trade will retry.
      console.error("Failed to refresh leaderboard:", error);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // Live updates require subscribing to trade INSERTs, which Realtime only
    // delivers to roles that can SELECT trades (signed-in users). Anon
    // visitors get a correct board on load but no live subscription (and no
    // "Live" indicator), rather than falsely claiming to be live.
    if (!isAuthenticated) return;

    const supabase = createClient();

    const scheduleRefetch = () => {
      if (timerRef.current) return; // a refresh is already pending
      const elapsed = Date.now() - lastRunRef.current;
      const delay = Math.max(0, REFRESH_INTERVAL_MS - elapsed);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        lastRunRef.current = Date.now();
        void refetch();
      }, delay);
    };

    const channel = supabase
      .channel("leaderboards-trades")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "trades" },
        scheduleRefetch,
      )
      .subscribe((status) => setIsLive(status === "SUBSCRIBED"));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, refetch]);

  const board = boards[activeTab];
  const isCurrentUserVisible = board.entries.some((entry) => entry.userId === currentUserId);
  const showPinnedRow = board.myRank !== null && !isCurrentUserVisible;

  return (
    <div>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="display-label text-xl text-foreground">Leaderboards</h1>
          <p className="mt-1 text-sm text-muted">The top traders across MelodyMarkets.</p>
        </div>
        {isAuthenticated && <LiveIndicator isLive={isLive} />}
      </header>

      <div className="mt-4">
        <LeaderboardStatsRow stats={stats} />
      </div>

      <div className="mt-6" role="tablist" aria-label="Leaderboard type">
        <div className="inline-flex rounded-control border border-border bg-surface p-1">
          {TABS.map((tab) => {
            const isActive = tab.kind === activeTab;
            return (
              <button
                key={tab.kind}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.kind)}
                className={cn(
                  "min-h-11 rounded-control px-4 text-sm display-label transition-colors",
                  isActive ? "bg-accent text-background" : "text-muted hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        {board.entries.length === 0 ? (
          <EmptyState kind={activeTab} />
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="divide-y divide-rail">
              {board.entries.map((entry) => (
                <LeaderboardRow
                  key={entry.userId}
                  entry={entry}
                  kind={activeTab}
                  isCurrentUser={entry.userId === currentUserId}
                />
              ))}
            </div>

            {showPinnedRow && board.myRank && (
              <div className="border-t-2 border-accent/40 bg-accent/5">
                <LeaderboardRow entry={board.myRank} kind={activeTab} isCurrentUser />
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function EmptyState({ kind }: { kind: LeaderboardKind }) {
  const description =
    kind === "return"
      ? "No one has traded yet. Make your first trade to claim a spot on the returns board."
      : "No portfolios to rank yet. Check back once traders join.";

  return (
    <Card className="mx-auto max-w-md text-center">
      <h2 className="display-label text-sm text-foreground">Nothing to rank yet</h2>
      <p className="mt-2 text-sm text-muted">{description}</p>
    </Card>
  );
}

function LiveIndicator({ isLive }: { isLive: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 display-label text-2xs text-muted">
      <span
        className={cn("h-1.5 w-1.5 rounded-full", isLive ? "bg-accent" : "bg-label")}
        aria-hidden="true"
      />
      {isLive ? "Live" : "Connecting"}
    </span>
  );
}
