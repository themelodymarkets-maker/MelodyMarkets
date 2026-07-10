import { PageShell } from "@/components/layout/PageShell";
import { LeaderboardView } from "@/components/leaderboards/LeaderboardView";
import { fetchLeaderboardBoard, fetchLeaderboardStats } from "@/lib/leaderboard";
import { createClient } from "@/lib/supabase/server";

/**
 * Server Component data fetch for /leaderboards. This route is PUBLIC -- the
 * board and stats RPCs are granted to `anon` too (see the
 * make_leaderboard_public migration) -- so `user` may be null for a signed-out
 * visitor.
 *
 * Both boards ('return' and 'value') plus the header stats are fetched on the
 * server in parallel and handed to the client view as plain props, so the
 * first paint is fully populated (no client-side fetch or loading flash). The
 * per-caller "You" rank (`get_my_rank`) is fetched only when signed in, since
 * that RPC is authenticated-only. A thrown error here is caught by the nearest
 * error boundary; Next renders `loading.tsx` while this awaits.
 */
export default async function LeaderboardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const includeMyRank = user !== null;

  const [returnBoard, valueBoard, stats] = await Promise.all([
    fetchLeaderboardBoard(supabase, "return", includeMyRank),
    fetchLeaderboardBoard(supabase, "value", includeMyRank),
    fetchLeaderboardStats(supabase),
  ]);

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-3xl">
        <LeaderboardView
          currentUserId={user?.id ?? null}
          initialBoards={{ return: returnBoard, value: valueBoard }}
          initialStats={stats}
        />
      </div>
    </PageShell>
  );
}
