import { formatPercent, type PriceDirection } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PriceChangePillProps {
  /** Signed percent change, e.g. 2.34 or -1.05. Exactly 0 renders as neutral. */
  percent: number;
  className?: string;
}

/**
 * Signed percentage change in the DATA face, with a directional arrow so the
 * gain/loss color is never the only cue (colorblind-safe). Neon glow on the
 * number so up/down pops against the deep-space field.
 */
export function PriceChangePill({ percent, className }: PriceChangePillProps) {
  const direction: PriceDirection = percent > 0 ? "up" : percent < 0 ? "down" : "flat";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-data tabular text-sm font-medium",
        direction === "up" && "text-gain text-glow-gain",
        direction === "down" && "text-loss text-glow-loss",
        direction === "flat" && "text-muted",
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
