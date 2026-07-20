import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Num } from "@/components/ui/Num";
import { Explain } from "@/components/ui/Explain";

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
      <h2 className="display-label text-sm text-foreground">Market stats</h2>

      <dl className="mt-4 space-y-3">
        <StatRow
          label={<Explain term="market cap"><span className="text-muted">Market cap</span></Explain>}
          value={
            <span className="text-foreground">
              <Num value={marketCap} variant="token" /> tokens
            </span>
          }
        />
        <StatRow
          label="Price snapshots"
          value={<Num value={snapshotCount} variant="count" className="text-foreground" />}
        />
        <StatRow
          label="Market created"
          value={<span className="font-data text-foreground">{dateFormatter.format(new Date(createdAt))}</span>}
        />
      </dl>
    </Card>
  );
}

function StatRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
