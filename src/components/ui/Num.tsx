import { cn } from "@/lib/utils";
import {
  formatCompactNumber,
  formatPercent,
  formatPrice,
  formatShares,
  formatSignedTokenAmount,
  formatTokenAmount,
} from "@/lib/format";

/**
 * How a number should be formatted. Every user-facing number goes through
 * <Num /> with one of these, so nothing can be formatted with the wrong rule
 * set by accident:
 *   token   token amount (2dp below 1k, compact above)
 *   price   spot/effective price (same shape as token)
 *   share   share quantity (up to 4dp, trailing zeros stripped)
 *   percent signed percent, one decimal
 *   count   large integer count (compact: listeners, plays, snapshots)
 */
export type NumVariant = "token" | "price" | "share" | "percent" | "count";

interface NumProps {
  value: number | null | undefined;
  variant: NumVariant;
  /** Token variant only: show an explicit +/- sign (for P/L and deltas). */
  signed?: boolean;
  className?: string;
  title?: string;
}

/**
 * The one way a number renders. Always DATA face, always tabular figures, so
 * digits share a fixed width and rows stop reflowing as values change.
 */
export function Num({ value, variant, signed = false, className, title }: NumProps) {
  return (
    <span className={cn("font-data tabular", className)} title={title}>
      {formatValue(value, variant, signed)}
    </span>
  );
}

function formatValue(value: number | null | undefined, variant: NumVariant, signed: boolean): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";

  switch (variant) {
    case "token":
      return signed ? formatSignedTokenAmount(value) : formatTokenAmount(value);
    case "price":
      return formatPrice(value);
    case "share":
      return formatShares(value);
    case "percent":
      return formatPercent(value);
    case "count":
      return formatCompactNumber(value);
  }
}
