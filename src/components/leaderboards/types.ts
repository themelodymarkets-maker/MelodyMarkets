/**
 * Client-side shapes for the leaderboards feature. These are the already-
 * public, per-user derived numbers returned by the `get_leaderboard` /
 * `get_my_rank` RPCs (see
 * supabase/migrations/20260709190000_create_leaderboard_functions.sql) --
 * never raw ledger or holdings rows.
 */

/** Which board is being viewed: ranked by total return %, or total portfolio value. */
export type LeaderboardKind = "return" | "value";

/** One ranked trader as shown in a board list. */
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatarUrl: string | null;
  /** token_balance + holdings_value (see the portfolio_summary migration). */
  totalValue: number;
  /** (total_value - total_credited) / total_credited * 100. */
  returnPercent: number;
}

/** The signed-in user's own position + stats on a board (from `get_my_rank`). */
export interface MyRankEntry extends LeaderboardEntry {
  tradeCount: number;
}

/** Small header counters shown above the board. */
export interface LeaderboardStats {
  totalTraders: number;
  tradesToday: number;
}

/** Everything needed to render one board: its top-N rows plus the caller's rank. */
export interface LeaderboardBoard {
  entries: LeaderboardEntry[];
  /** null when the caller isn't ranked on this board (e.g. never traded, 'return' board). */
  myRank: MyRankEntry | null;
}
