-- Make the leaderboards page publicly viewable (signed-out visitors included).
--
-- Product decision: the global leaderboard is a showcase/marketing surface, so
-- it should render for anonymous visitors just like /markets already does.
-- What that board exposes -- rank, username, avatar_url, total portfolio value,
-- and return % -- is the same already-public, per-user *derived* data it has
-- always shown; this does NOT widen access to any raw ledger or holdings row.
-- The internal aggregator public._leaderboard_rows() stays revoked from anon
-- (and authenticated); only the curated top-N wrapper is opened up.
--
-- get_my_rank() is deliberately NOT granted to anon: it is inherently a
-- "the caller's own row" lookup (it asserts auth.uid() is not null), and a
-- signed-out visitor has no such row. The UI simply omits the "You" row for
-- anonymous viewers.
grant execute on function public.get_leaderboard(text, int) to anon;
grant execute on function public.get_leaderboard_stats() to anon;

-- NOTE ON LIVE UPDATES FOR ANONYMOUS VIEWERS: intentionally NOT enabled here.
-- The page's live refresh subscribes to trade INSERTs, and Realtime only
-- delivers rows the subscribing role can SELECT. We deliberately do NOT add an
-- anon SELECT policy on public.trades -- that would expose the entire raw
-- trade tape (every user's per-trade amounts) to the public, which is far more
-- than "view the leaderboard". Signed-in users keep the live board (they can
-- already read trades); signed-out visitors get a correct board on load that
-- simply doesn't auto-refresh. If a live public board is ever wanted, expose a
-- narrow aggregate (e.g. a Realtime broadcast or a minimal anon-readable
-- "trade happened" signal) rather than opening up the trades table.
