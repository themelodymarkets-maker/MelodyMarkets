/**
 * Fixed Tailwind width classes shared by `PortfolioPositionsListHeader` and
 * `PortfolioPositionRow` so header labels line up with their data column in
 * every row -- same rationale as `src/components/markets/columns.ts`.
 */
export const POSITION_COLUMN_WIDTHS = {
  avatar: "h-11 w-11",
  avgCost: "w-24",
  price: "w-24",
  marketValue: "w-28",
  pl: "w-32",
} as const;
