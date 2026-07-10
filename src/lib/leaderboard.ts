import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  LeaderboardBoard,
  LeaderboardEntry,
  LeaderboardKind,
  LeaderboardStats,
  MyRankEntry,
} from "@/components/leaderboards/types";
import type { Database, LeaderboardRpcRow, MyRankRpcRow } from "@/types/database";

/**
 * Data access for the leaderboards feature, shared by the server page (first
 * paint) and the client view (live refetch on Realtime trade inserts) so both
 * map the `get_leaderboard` / `get_my_rank` / `get_leaderboard_stats` RPCs
 * (see the leaderboard migration) identically.
 *
 * Postgres `numeric` values arrive as strings over the wire (to avoid float
 * precision loss), so every numeric field is explicitly `Number(...)`-cast
 * here, at the single boundary where RPC rows become plain app data.
 */

/** How many ranked rows each board shows. Matches the default cap in `get_leaderboard`. */
export const LEADERBOARD_LIMIT = 50;

type Client = SupabaseClient<Database>;

/**
 * The top-N rows for one board, plus (for signed-in callers) the caller's own
 * rank on it. `includeMyRank` must be false for anonymous visitors: the board
 * itself is public, but `get_my_rank` is a per-caller lookup granted to
 * `authenticated` only and would reject an anon request.
 */
export async function fetchLeaderboardBoard(
  supabase: Client,
  kind: LeaderboardKind,
  includeMyRank: boolean,
): Promise<LeaderboardBoard> {
  const [boardResult, myRankResult] = await Promise.all([
    supabase.rpc("get_leaderboard", { p_kind: kind, p_limit: LEADERBOARD_LIMIT }),
    includeMyRank ? supabase.rpc("get_my_rank", { p_kind: kind }) : Promise.resolve(null),
  ]);

  if (boardResult.error) {
    throw new Error(`Failed to load ${kind} leaderboard: ${boardResult.error.message}`);
  }
  if (myRankResult?.error) {
    throw new Error(`Failed to load your ${kind} rank: ${myRankResult.error.message}`);
  }

  const entries = (boardResult.data ?? []).map(mapEntry);

  // `get_my_rank` returns no row when the caller isn't ranked on this board
  // (e.g. the 'return' board when they've never traded), and is skipped
  // entirely for anonymous viewers -- both treated as null (no "You" row).
  const myRankRow = (myRankResult?.data ?? [])[0];
  const myRank: MyRankEntry | null = myRankRow
    ? { ...mapEntry(myRankRow), tradeCount: Number(myRankRow.trade_count) }
    : null;

  return { entries, myRank };
}

/** The small header counters (total traders, trades today). */
export async function fetchLeaderboardStats(supabase: Client): Promise<LeaderboardStats> {
  const { data, error } = await supabase.rpc("get_leaderboard_stats").single();

  if (error) {
    throw new Error(`Failed to load leaderboard stats: ${error.message}`);
  }

  return {
    totalTraders: Number(data?.total_traders ?? 0),
    tradesToday: Number(data?.trades_today ?? 0),
  };
}

function mapEntry(row: LeaderboardRpcRow | MyRankRpcRow): LeaderboardEntry {
  return {
    rank: Number(row.rank),
    userId: row.user_id,
    username: row.username,
    avatarUrl: row.avatar_url,
    totalValue: Number(row.total_value),
    returnPercent: Number(row.return_pct),
  };
}
