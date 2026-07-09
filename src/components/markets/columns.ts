/**
 * Fixed Tailwind width classes shared by `MarketsListHeader` and `MarketRow`
 * so header labels line up with their data column in every row, regardless
 * of how long any given row's content is (a plain CSS Grid per-row would let
 * "auto" columns drift out of alignment row to row).
 */
export const MARKET_COLUMN_WIDTHS = {
  avatar: "h-11 w-11",
  listeners: "w-24",
  sparkline: "w-[72px]",
  price: "w-24 sm:w-28",
  change: "w-24",
} as const;
