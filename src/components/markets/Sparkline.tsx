interface SparklineProps {
  /** Real price values, oldest to newest. Rendered exactly as given -- no smoothing or fabricated points. */
  prices: number[];
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Tiny inline 24h price trend line for a `MarketRow`. Deliberately a plain,
 * dependency-free SVG polyline rather than a full Recharts chart: dozens of
 * these render at once in the watchlist, and a sparkline has no axes,
 * tooltip, or interactivity to justify the extra weight per row (the full
 * interactive chart lives on the artist page as `PriceChart`).
 *
 * Renders only the real snapshot prices it's given -- see
 * `getSparklines` in `src/app/markets/page.tsx` -- never an interpolated or
 * extrapolated point. Fewer than 2 points can't describe a trend, so those
 * cases render a flat neutral dash instead of guessing a direction.
 */
export function Sparkline({ prices, width = 72, height = 28, className }: SparklineProps) {
  if (prices.length < 2) {
    return (
      <svg width={width} height={height} className={className} aria-hidden="true">
        <line
          x1={4}
          y1={height / 2}
          x2={width - 4}
          y2={height / 2}
          stroke="var(--color-border)"
          strokeWidth={2}
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const padding = 2;

  const points = prices.map((price, index) => {
    const x = (index / (prices.length - 1)) * (width - padding * 2) + padding;
    const y = height - padding - ((price - min) / range) * (height - padding * 2);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const isUp = prices[prices.length - 1] >= prices[0];
  const strokeColor = isUp ? "var(--color-gain)" : "var(--color-loss)";

  return (
    <svg width={width} height={height} className={className} aria-hidden="true">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
