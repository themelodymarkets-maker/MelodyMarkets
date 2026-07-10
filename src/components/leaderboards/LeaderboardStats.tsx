import { formatCompactNumber } from "@/lib/format";
import type { LeaderboardStats } from "./types";

interface LeaderboardStatsRowProps {
  stats: LeaderboardStats;
}

/** Small header counters: how many traders exist and how many trades happened today. */
export function LeaderboardStatsRow({ stats }: LeaderboardStatsRowProps) {
  return (
    <dl className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <Stat label="Traders" value={formatCompactNumber(stats.totalTraders)} />
      <span className="h-4 w-px bg-border" aria-hidden="true" />
      <Stat label="Trades today" value={formatCompactNumber(stats.tradesToday)} />
    </dl>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dd className="text-sm font-semibold text-foreground tabular-nums">{value}</dd>
      <dt className="text-xs text-muted">{label}</dt>
    </div>
  );
}
