import { formatPercent, type PriceDirection } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PriceChangePillProps {
  /** Signed percent change, e.g. 2.34 or -1.05. Exactly 0 renders as neutral. */
  percent: number;
  className?: string;
}

/**
 * Green/red pill with a directional arrow showing a signed percentage
 * change. Shared by every page that surfaces price movement (markets
 * watchlist today; artist detail and portfolio later).
 */
export function PriceChangePill({ percent, className }: PriceChangePillProps) {
  const direction: PriceDirection = percent > 0 ? "up" : percent < 0 ? "down" : "flat";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
        direction === "up" && "bg-gain/10 text-gain",
        direction === "down" && "bg-loss/10 text-loss",
        direction === "flat" && "bg-muted/10 text-muted",
        className,
      )}
    >
      <DirectionArrow direction={direction} />
      {formatPercent(percent)}
    </span>
  );
}

function DirectionArrow({ direction }: { direction: PriceDirection }) {
  if (direction === "flat") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        className="h-3 w-3"
        aria-hidden="true"
      >
        <path strokeLinecap="round" d="M5 12h14" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      className={cn("h-3 w-3", direction === "down" && "rotate-180")}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  );
}
