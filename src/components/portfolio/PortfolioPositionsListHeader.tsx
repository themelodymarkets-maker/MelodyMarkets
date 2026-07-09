import { POSITION_COLUMN_WIDTHS } from "./columns";

/**
 * Column labels above the positions table rows. Hidden on small screens,
 * where `PortfolioPositionRow` collapses to fewer columns and labels would
 * just add noise -- same pattern as `MarketsListHeader`.
 */
export function PortfolioPositionsListHeader() {
  return (
    <div className="hidden items-center gap-4 border-b border-border px-6 py-2.5 text-xs font-medium tracking-wide text-muted uppercase sm:flex">
      <span className={POSITION_COLUMN_WIDTHS.avatar} aria-hidden="true" />
      <span className="flex-1">Artist</span>
      <span className={`${POSITION_COLUMN_WIDTHS.avgCost} text-right`}>Avg cost</span>
      <span className={`${POSITION_COLUMN_WIDTHS.price} text-right`}>Price</span>
      <span className={`${POSITION_COLUMN_WIDTHS.marketValue} text-right`}>Value</span>
      <span className={`${POSITION_COLUMN_WIDTHS.pl} text-right`}>Unrealized P/L</span>
    </div>
  );
}
