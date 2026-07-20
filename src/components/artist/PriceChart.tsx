"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { PriceChangePill } from "@/components/ui/PriceChangePill";
import { Num } from "@/components/ui/Num";
import { computePercentChange } from "@/lib/format";
import {
  PRICE_HISTORY_RANGES,
  PRICE_HISTORY_RANGE_LABELS,
  type PriceHistoryRange,
  type PricePoint,
} from "@/lib/price-history";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database";
import { cn } from "@/lib/utils";

interface PriceChartProps {
  artistId: string;
  /** ISO timestamp the artist's market was created, used for the honesty note. */
  marketCreatedAt: string;
  initialRange: PriceHistoryRange;
  initialPoints: PricePoint[];
  /** Total `price_snapshots` rows for this artist across all time, not just `initialRange`. */
  initialTotalSnapshotCount: number;
}

/** Below this many total (all-time) snapshots, always show the honesty note. */
const HONESTY_NOTE_THRESHOLD = 10;

const openedDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/**
 * Client Component: the real, only-ever-real price history chart.
 *
 * Renders exactly the rows `price_snapshots` contains for the selected range
 * (fetched server-side for `initialRange`, and on demand for every other tab
 * via `/api/artists/:artistId/price-history`), never an interpolated or
 * fabricated point. New points are appended the moment a real row is
 * INSERTed (a trade or the daily cron job), via a Realtime subscription on
 * `price_snapshots`, never via a client-side guess at "what the price is now".
 */
export function PriceChart({
  artistId,
  marketCreatedAt,
  initialRange,
  initialPoints,
  initialTotalSnapshotCount,
}: PriceChartProps) {
  const [range, setRange] = useState<PriceHistoryRange>(initialRange);
  const [pointsByRange, setPointsByRange] = useState<Partial<Record<PriceHistoryRange, PricePoint[]>>>(
    () => ({ [initialRange]: initialPoints }),
  );
  const [loadingRange, setLoadingRange] = useState<PriceHistoryRange | null>(null);
  const [errorRange, setErrorRange] = useState<PriceHistoryRange | null>(null);
  const [totalSnapshotCount, setTotalSnapshotCount] = useState(initialTotalSnapshotCount);

  // Every fetched/live-appended range is cached in `pointsByRange`, so this
  // ref lets the realtime handler read the latest cache without needing to
  // be re-subscribed every time it changes.
  const pointsByRangeRef = useRef(pointsByRange);
  pointsByRangeRef.current = pointsByRange;

  const fetchRange = useCallback(
    async (targetRange: PriceHistoryRange) => {
      setLoadingRange(targetRange);
      setErrorRange(null);
      try {
        const response = await fetch(
          `/api/artists/${artistId}/price-history?range=${targetRange}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error(`Request failed with ${response.status}`);
        const body = (await response.json()) as { points: PricePoint[] };
        setPointsByRange((current) => ({ ...current, [targetRange]: body.points }));
      } catch (error) {
        console.error(`Failed to load ${targetRange} price history:`, error);
        setErrorRange(targetRange);
      } finally {
        setLoadingRange(null);
      }
    },
    [artistId],
  );

  function handleRangeChange(nextRange: PriceHistoryRange) {
    setRange(nextRange);
    if (!pointsByRangeRef.current[nextRange]) {
      void fetchRange(nextRange);
    }
  }

  // Live updates: append every new real price_snapshots row for this artist
  // (written by a trade or the daily cron) to every cached range: the new
  // row's timestamp is "now", so it always falls inside every range's window.
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`artist-price-history-${artistId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "price_snapshots",
          filter: `artist_id=eq.${artistId}`,
        },
        (payload) => {
          const inserted = payload.new as Tables<"price_snapshots">;
          const newPoint: PricePoint = { price: Number(inserted.price), createdAt: inserted.created_at };

          setPointsByRange((current) => {
            const next: Partial<Record<PriceHistoryRange, PricePoint[]>> = {};
            for (const key of PRICE_HISTORY_RANGES) {
              const existing = current[key];
              next[key] = existing ? [...existing, newPoint] : existing;
            }
            return { ...current, ...next };
          });
          setTotalSnapshotCount((count) => count + 1);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [artistId]);

  const points = pointsByRange[range];
  const isLoading = loadingRange === range;
  const hasError = errorRange === range;
  const showHonestyNote = totalSnapshotCount < HONESTY_NOTE_THRESHOLD;

  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="display-label text-sm text-foreground">Price history</h2>
          <ChangeSummary points={points} />
        </div>
        <RangeTabs range={range} onChange={handleRangeChange} />
      </div>

      <div className="mt-4 h-64">
        {isLoading && !points ? (
          <ChartMessage text="Loading price history." />
        ) : hasError && !points ? (
          <ChartMessage text="Could not load price history. Try another range." />
        ) : !points || points.length === 0 ? (
          <ChartMessage text="No price activity in this range yet." />
        ) : (
          <PriceAreaChart points={points} range={range} />
        )}
      </div>

      {showHonestyNote && (
        <p className="mt-4 text-xs text-muted">
          Market opened {openedDateFormatter.format(new Date(marketCreatedAt))}. History builds in
          real time.
        </p>
      )}
    </Card>
  );
}

function ChangeSummary({ points }: { points: PricePoint[] | undefined }) {
  if (!points || points.length < 2) {
    return <p className="mt-1 text-sm text-muted">Not enough data yet for a change.</p>;
  }

  const first = points[0].price;
  const last = points[points.length - 1].price;
  const { percent } = computePercentChange(first, last);
  const diff = last - first;

  return (
    <div className="mt-1 flex items-center gap-2">
      <span className="text-sm text-foreground">
        <Num value={diff} variant="token" signed /> tokens
      </span>
      <PriceChangePill percent={percent} />
    </div>
  );
}

function RangeTabs({
  range,
  onChange,
}: {
  range: PriceHistoryRange;
  onChange: (range: PriceHistoryRange) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-background p-1">
      {PRICE_HISTORY_RANGES.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            "min-h-11 min-w-11 rounded-full px-3 text-xs display-label transition-[transform,background-color,color,box-shadow] duration-100 ease-out active:scale-95",
            option === range
              ? "bg-accent text-background glow-accent"
              : "text-muted hover:text-foreground",
          )}
          aria-pressed={option === range}
        >
          {PRICE_HISTORY_RANGE_LABELS[option]}
        </button>
      ))}
    </div>
  );
}

function ChartMessage({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-card border border-dashed border-border">
      <p className="text-sm text-muted">{text}</p>
    </div>
  );
}

function formatTimestamp(iso: string, range: PriceHistoryRange): string {
  const date = new Date(iso);
  if (range === "1d") {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
  }
  if (range === "all") {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
      date,
    );
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

interface CrosshairCursorProps {
  points?: Array<{ x: number; y: number }>;
  height?: number;
}

/** Vertical crosshair + a dot pinned to the hovered price, drawn over the area chart. */
function CrosshairCursor({ points, height }: CrosshairCursorProps) {
  if (!points || points.length === 0 || height === undefined) return null;
  const { x, y } = points[0];

  return (
    <g>
      <line x1={x} y1={0} x2={x} y2={height} stroke="var(--accent)" strokeWidth={1} strokeDasharray="4 4" />
      <circle cx={x} cy={y} r={4} fill="var(--accent)" stroke="var(--background)" strokeWidth={2} />
    </g>
  );
}

function PriceAreaChart({ points, range }: { points: PricePoint[]; range: PriceHistoryRange }) {
  const domain = useMemo<[number, number]>(() => {
    const prices = points.map((point) => point.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = Math.max((max - min) * 0.1, max * 0.01, 0.01);
    return [min - padding, max + padding];
  }, [points]);

  const renderTooltip = useCallback(
    ({ active, payload }: TooltipContentProps) => {
      if (!active || !payload || payload.length === 0) return null;
      const point = payload[0].payload as PricePoint;
      return (
        <div className="rounded-card border border-border bg-surface px-3 py-2">
          <p className="text-sm text-foreground">
            <Num value={point.price} variant="price" /> tokens
          </p>
          <p className="mt-0.5 font-data text-xs text-muted">{formatTimestamp(point.createdAt, range)}</p>
        </div>
      );
    },
    [range],
  );

  return (
    <div className="mm-chart-heartbeat h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="mm-price-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.45} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="createdAt" hide />
          <YAxis domain={domain} hide />
          <Tooltip
            content={renderTooltip}
            cursor={<CrosshairCursor />}
            isAnimationActive={false}
            // Keep the tooltip inside the chart box so it never renders off the
            // side of the screen on mobile.
            allowEscapeViewBox={{ x: false, y: false }}
            wrapperStyle={{ zIndex: 1 }}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke="var(--accent)"
            strokeWidth={2.75}
            fill="url(#mm-price-fill)"
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
