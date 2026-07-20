import { Card } from "@/components/ui/Card";
import { PriceChangePill } from "@/components/ui/PriceChangePill";
import { Num } from "@/components/ui/Num";
import { Explain } from "@/components/ui/Explain";

interface PortfolioSummaryHeaderProps {
  /** Token balance + holdings value (see `src/lib/portfolio.ts`). */
  totalValue: number;
  /** (totalValue - totalCredited) / totalCredited * 100 (see `src/lib/portfolio.ts`). */
  returnPercent: number;
  /** Spendable token balance, from the append-only token_ledger. */
  tokenBalance: number;
}

/**
 * Presentational header panel: total portfolio value (large), the total
 * return pill, and the user's spendable token balance. A pure function of
 * props, so it re-renders instantly whenever `PortfolioView` recomputes these
 * numbers off a live market price tick; it holds no state itself.
 */
export function PortfolioSummaryHeader({
  totalValue,
  returnPercent,
  tokenBalance,
}: PortfolioSummaryHeaderProps) {
  return (
    <Card>
      <span className="display-label text-2xs text-muted">Total portfolio value</span>

      <div className="mt-2 flex flex-wrap items-end gap-3">
        <span className="text-2xl text-foreground text-glow">
          <Num value={totalValue} variant="token" />
          <span className="ml-2 text-base text-muted">tokens</span>
        </span>
        <span className="mb-1.5 flex items-center gap-1.5">
          <Explain term="return">
            <span className="display-label text-2xs text-muted">Return</span>
          </Explain>
          <PriceChangePill percent={returnPercent} />
        </span>
      </div>

      <div className="mt-6 flex items-center gap-2 border-t border-border pt-4 text-sm">
        <span className="text-muted">Token balance</span>
        <Num value={tokenBalance} variant="token" className="text-token text-glow-token" />
      </div>
    </Card>
  );
}
