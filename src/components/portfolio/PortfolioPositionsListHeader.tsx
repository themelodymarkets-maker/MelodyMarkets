import { Explain } from "@/components/ui/Explain";
import { POSITION_COLUMN_WIDTHS } from "./columns";

/**
 * Column labels above the positions table. Hidden on small screens, where
 * `PortfolioPositionRow` collapses to a stacked card and labels would just
 * add noise, same pattern as `MarketsListHeader`.
 */
export function PortfolioPositionsListHeader() {
  return (
    <div className="hidden items-center gap-4 border-b border-border px-6 py-2.5 display-label text-2xs text-muted sm:flex">
      <span className={POSITION_COLUMN_WIDTHS.avatar} aria-hidden="true" />
      <span className="flex-1">Artist</span>
      <span className={`${POSITION_COLUMN_WIDTHS.avgCost} text-right`}>
        <Explain term="cost basis">Avg cost</Explain>
      </span>
      <span className={`${POSITION_COLUMN_WIDTHS.price} text-right`}>Price</span>
      <span className={`${POSITION_COLUMN_WIDTHS.marketValue} text-right`}>Value</span>
      <span className={`${POSITION_COLUMN_WIDTHS.pl} text-right`}>
        <Explain term="unrealized P/L">Unrealized P/L</Explain>
      </span>
    </div>
  );
}
