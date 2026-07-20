import { cn } from "@/lib/utils";

interface RankBadgeProps {
  rank: number;
}

/**
 * The rank indicator on the left of every leaderboard row. The top three are
 * cyan intensity tiers (brightest for first); everyone else gets a plain
 * indigo number. Cyan is the brand color, so rank standing reads as a
 * product signal, not as market data.
 */
export function RankBadge({ rank }: RankBadgeProps) {
  const tier = TIERS[rank];

  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-data tabular text-sm font-bold",
        tier ?? "border border-border bg-surface font-medium text-muted",
      )}
      aria-hidden="true"
    >
      {rank}
    </span>
  );
}

/** Cyan neon tiers keyed by rank. Undefined for rank >= 4. */
const TIERS: Record<number, string> = {
  1: "bg-accent text-background glow-accent",
  2: "bg-accent/60 text-background",
  3: "bg-accent-dim text-foreground",
};
