import { Card } from "@/components/ui/Card";
import { PriceChangePill } from "@/components/ui/PriceChangePill";
import { formatTokenAmount } from "@/lib/format";

interface PortfolioSummaryHeaderProps {
  /** Token balance + holdings value (see `src/lib/portfolio.ts`). */
  totalValue: number;
  /** (totalValue - totalCredited) / totalCredited * 100 (see `src/lib/portfolio.ts`). */
  returnPercent: number;
  /** Spendable token balance, from the append-only token_ledger. */
  tokenBalance: number;
}

/**
 * Presentational header card: total portfolio value (large), the total
 * return % pill, and the user's spendable token balance. A pure function of
 * props, so it re-renders instantly whenever `PortfolioView` recomputes
 * these numbers off a live market price tick -- it holds no state itself.
 */
export function PortfolioSummaryHeader({
  totalValue,
  returnPercent,
  tokenBalance,
}: PortfolioSummaryHeaderProps) {
  return (
    <Card>
      <span className="text-xs font-semibold tracking-widest text-muted uppercase">
        Total portfolio value
      </span>

      <div className="mt-2 flex flex-wrap items-end gap-3">
        <span className="text-4xl font-semibold text-foreground tabular-nums sm:text-5xl">
          {formatTokenAmount(totalValue)}
          <span className="ml-2 text-base font-normal text-muted">tokens</span>
        </span>
        <PriceChangePill percent={returnPercent} className="mb-2" />
      </div>

      <div className="mt-6 flex items-center gap-2 border-t border-border pt-4 text-sm">
        <span className="text-muted">Token balance</span>
        <span className="font-semibold text-foreground tabular-nums">
          {formatTokenAmount(tokenBalance)}
        </span>
      </div>
    </Card>
  );
}
