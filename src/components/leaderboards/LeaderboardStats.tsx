import { Num } from "@/components/ui/Num";
import type { LeaderboardStats } from "./types";

interface LeaderboardStatsRowProps {
  stats: LeaderboardStats;
}

/** Small header counters: how many traders exist and how many trades happened today. */
export function LeaderboardStatsRow({ stats }: LeaderboardStatsRowProps) {
  return (
    <dl className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <Stat label="Traders" value={stats.totalTraders} />
      <span className="h-4 w-px bg-border" aria-hidden="true" />
      <Stat label="Trades today" value={stats.tradesToday} />
    </dl>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dd className="text-sm text-foreground">
        <Num value={value} variant="count" />
      </dd>
      <dt className="display-label text-2xs text-muted">{label}</dt>
    </div>
  );
}
