import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface RankBadgeProps {
  rank: number;
}

/**
 * The circular rank indicator on the left of every leaderboard row. The top
 * three get distinct gold / silver / bronze treatments with a subtle glow (a
 * soft pulsing box-shadow defined in globals.css as `.mm-rank-glow`, which is
 * disabled under prefers-reduced-motion); everyone else gets a plain muted
 * number.
 */
export function RankBadge({ rank }: RankBadgeProps) {
  const medal = MEDALS[rank];

  if (!medal) {
    return (
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-hover text-sm font-semibold text-muted tabular-nums"
        aria-hidden="true"
      >
        {rank}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "mm-rank-glow flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums",
        medal.text,
      )}
      style={
        {
          backgroundImage: medal.gradient,
          "--mm-glow-color": medal.glow,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      {rank}
    </span>
  );
}

/** Gold / silver / bronze styling keyed by rank. Undefined for rank >= 4. */
const MEDALS: Record<number, { gradient: string; text: string; glow: string }> = {
  1: {
    gradient: "linear-gradient(135deg, #fde68a 0%, #f59e0b 100%)",
    text: "text-[#3a2a05]",
    glow: "rgba(245, 158, 11, 0.55)",
  },
  2: {
    gradient: "linear-gradient(135deg, #f1f5f9 0%, #94a3b8 100%)",
    text: "text-[#1f2733]",
    glow: "rgba(148, 163, 184, 0.5)",
  },
  3: {
    gradient: "linear-gradient(135deg, #f5c98f 0%, #b45309 100%)",
    text: "text-[#2f1a05]",
    glow: "rgba(180, 83, 9, 0.5)",
  },
};
