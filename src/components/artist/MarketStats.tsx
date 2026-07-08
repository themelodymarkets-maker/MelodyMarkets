import { Card } from "@/components/ui/Card";
import { formatCompactNumber, formatTokenAmount } from "@/lib/format";

interface MarketStatsProps {
  /** price * share_reserve, in tokens. */
  marketCap: number;
  snapshotCount: number;
  /** ISO timestamp of the market row's creation. */
  createdAt: string;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** Server Component: sidebar summary of this artist's market, sized for the desktop rail. */
export function MarketStats({ marketCap, snapshotCount, createdAt }: MarketStatsProps) {
  return (
    <Card>
      <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Market stats</h2>

      <dl className="mt-4 space-y-3">
        <StatRow label="Market cap" value={`${formatTokenAmount(marketCap)} tokens`} />
        <StatRow label="Price snapshots" value={formatCompactNumber(snapshotCount)} />
        <StatRow label="Market created" value={dateFormatter.format(new Date(createdAt))} />
      </dl>
    </Card>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-foreground tabular-nums">{value}</dd>
    </div>
  );
}
