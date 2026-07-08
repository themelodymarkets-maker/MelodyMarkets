import { MARKET_COLUMN_WIDTHS } from "./columns";

/**
 * Column labels above the watchlist rows. Hidden on small screens, where
 * `MarketRow` collapses to fewer columns and labels would just add noise.
 */
export function MarketsListHeader() {
  return (
    <div className="hidden items-center gap-4 border-b border-border px-6 py-2.5 text-xs font-medium tracking-wide text-muted uppercase sm:flex">
      <span className={MARKET_COLUMN_WIDTHS.avatar} aria-hidden="true" />
      <span className="flex-1">Artist</span>
      <span className={`${MARKET_COLUMN_WIDTHS.listeners} text-right`}>Listeners</span>
      <span className={`${MARKET_COLUMN_WIDTHS.price} text-right`}>Price</span>
      <span className={`${MARKET_COLUMN_WIDTHS.change} text-right`}>24h</span>
    </div>
  );
}
