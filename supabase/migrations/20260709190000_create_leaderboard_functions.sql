-- Global leaderboards: ranked traders by total return % or total portfolio value.
--
-- ===========================================================================
-- SECURITY MODEL (read this first)
-- ===========================================================================
-- A leaderboard is inherently a cross-user read: to rank everyone you must
-- total every user's token_ledger and holdings. But RLS on those tables only
-- ever lets a signed-in user see THEIR OWN ledger/holdings rows (see the
-- token_ledger and holdings migrations -- neither has a policy exposing other
-- users' rows). We must NOT weaken that: users must never gain the ability to
-- read another user's raw ledger or holdings.
--
-- The resolution is exactly the pattern get_portfolio_summary() already uses:
-- do the privileged totalling inside a SECURITY DEFINER function (which runs
-- with the owner's privileges and so bypasses RLS) and return ONLY the derived,
-- already-public leaderboard shape -- rank, user id, username, avatar_url,
-- total portfolio value, and return % -- never a single raw ledger/holdings
-- row. search_path is pinned to '' so a caller cannot shadow `public` and
-- hijack the elevated context; every reference below is schema-qualified.
--
-- The heavy cross-user computation lives in ONE internal helper,
-- public._leaderboard_rows(), whose EXECUTE is revoked from everyone. It is
-- reachable only by the two public-facing wrappers below (get_leaderboard /
-- get_my_rank), which -- being SECURITY DEFINER owned by the same role -- can
-- call it because an object owner always retains privileges on its own objects
-- regardless of REVOKE. Clients can only ever reach the curated wrappers:
--   * get_leaderboard(kind, limit) -> the public top-N board (already public data)
--   * get_my_rank(kind)            -> ONLY the caller's own row (filtered to auth.uid())
-- Both are granted to `authenticated` only (never anon), mirroring
-- get_portfolio_summary()'s audience.
--
-- ===========================================================================
-- DEFINITIONS (the single source of truth is get_portfolio_summary(); this
-- reproduces that exact formula, but set-based across ALL users at once)
-- ===========================================================================
--   * token_balance  = sum of the user's token_ledger rows
--   * holdings_value  = sum over positions of shares * (token_reserve/share_reserve)
--   * total_value     = token_balance + holdings_value
--   * total_credited  = sum of ledger rows the user was GIVEN
--                       (reason in ('signup_bonus','stripe_purchase'))
--   * return_pct      = (total_value - total_credited) / total_credited * 100
--                       (0 when total_credited is 0)
-- These MUST stay identical to
-- 20260709120000_create_portfolio_summary_function.sql and its TS twin
-- src/lib/portfolio.ts; if you change one, change all three.
--
-- 'return' board: a user who has NEVER traded is excluded -- an untouched
-- signup bonus is not a "return", it is just the starting balance sitting
-- still. 'value' board ranks everyone (even the never-traded), since holding
-- the starting balance is a legitimate, if unimpressive, portfolio value.
--
-- ===========================================================================
-- PERFORMANCE / FUTURE OPTIMIZATION -- INTENTIONALLY NOT BUILT YET
-- ===========================================================================
-- This helper recomputes the ENTIRE ranked board on every call, scanning all
-- of token_ledger + holdings + trades. At MelodyMarkets' current scale that is
-- trivial and the simplicity is worth far more than the microseconds. If the
-- board ever becomes a hot path (many concurrent viewers, each refetching on
-- every trade over Realtime), the obvious next step is to precompute it:
-- materialize per-user (total_value, return_pct, trade_count) into a
-- MATERIALIZED VIEW (or a plain summary table), REFRESH it on a schedule
-- (e.g. an every-few-minutes cron alongside /api/cron/snapshot, or REFRESH
-- MATERIALIZED VIEW CONCURRENTLY triggered after trades) and have these
-- functions read the precomputed rows instead of re-aggregating live. Do NOT
-- build that yet -- keep this simple until the numbers say otherwise.
create or replace function public._leaderboard_rows(p_kind text)
returns table (
  rank bigint,
  user_id uuid,
  username text,
  avatar_url text,
  total_value numeric,
  return_pct numeric,
  trade_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with balances as (
    select
      tl.user_id,
      coalesce(sum(tl.amount), 0) as token_balance,
      coalesce(
        sum(tl.amount) filter (where tl.reason in ('signup_bonus', 'stripe_purchase')),
        0
      ) as total_credited
    from public.token_ledger tl
    group by tl.user_id
  ),
  holdings_value as (
    select
      h.user_id,
      coalesce(sum(h.shares * (m.token_reserve / m.share_reserve)), 0) as holdings_value
    from public.holdings h
    join public.markets m on m.artist_id = h.artist_id
    where h.shares > 0
    group by h.user_id
  ),
  trade_counts as (
    select t.user_id, count(*) as trade_count
    from public.trades t
    group by t.user_id
  ),
  computed as (
    select
      p.id as user_id,
      p.username,
      p.avatar_url,
      coalesce(b.token_balance, 0) + coalesce(hv.holdings_value, 0) as total_value,
      case
        when coalesce(b.total_credited, 0) > 0
          then ((coalesce(b.token_balance, 0) + coalesce(hv.holdings_value, 0)) - b.total_credited)
               / b.total_credited * 100
        else 0
      end as return_pct,
      coalesce(tc.trade_count, 0) as trade_count
    from public.profiles p
    left join balances b on b.user_id = p.id
    left join holdings_value hv on hv.user_id = p.id
    left join trade_counts tc on tc.user_id = p.id
    -- 'return' board excludes the never-traded (bonus alone is not a return).
    where p_kind = 'value' or coalesce(tc.trade_count, 0) > 0
  )
  select
    rank() over (
      order by
        case when p_kind = 'return' then c.return_pct end desc nulls last,
        case when p_kind = 'value' then c.total_value end desc nulls last
    ) as rank,
    c.user_id,
    c.username,
    c.avatar_url,
    c.total_value,
    c.return_pct,
    c.trade_count
  from computed c;
$$;

-- Internal only: no one may call the raw cross-user aggregator directly. The
-- wrappers below reach it as the function owner (ownership implies EXECUTE).
revoke execute on function public._leaderboard_rows(text) from public;
revoke execute on function public._leaderboard_rows(text) from anon;
revoke execute on function public._leaderboard_rows(text) from authenticated;

-- ---------------------------------------------------------------------------
-- Public top-N board. Returns already-public data (rank/name/value/return%);
-- p_limit is validated and hard-capped so a caller cannot request an
-- unbounded scan.
-- ---------------------------------------------------------------------------
create or replace function public.get_leaderboard(p_kind text, p_limit int default 50)
returns table (
  rank bigint,
  user_id uuid,
  username text,
  avatar_url text,
  total_value numeric,
  return_pct numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_kind is null or p_kind not in ('return', 'value') then
    raise exception 'INVALID_KIND'
      using detail = 'Leaderboard kind must be ''return'' or ''value''.';
  end if;

  if p_limit is null or p_limit <= 0 then
    p_limit := 50;
  end if;
  -- Bound per-call work regardless of what a client asks for.
  p_limit := least(p_limit, 200);

  return query
    select r.rank, r.user_id, r.username, r.avatar_url, r.total_value, r.return_pct
    from public._leaderboard_rows(p_kind) r
    order by r.rank
    limit p_limit;
end;
$$;

revoke execute on function public.get_leaderboard(text, int) from public;
revoke execute on function public.get_leaderboard(text, int) from anon;
grant execute on function public.get_leaderboard(text, int) to authenticated;

-- ---------------------------------------------------------------------------
-- The caller's OWN rank + stats. Filtered to auth.uid() so a signed-in user
-- can only ever see their own position -- never anyone else's. Returns no row
-- when the caller isn't ranked on this board (e.g. the 'return' board when
-- they have never traded), which the UI treats as "unranked".
-- ---------------------------------------------------------------------------
create or replace function public.get_my_rank(p_kind text)
returns table (
  rank bigint,
  user_id uuid,
  username text,
  avatar_url text,
  total_value numeric,
  return_pct numeric,
  trade_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'NOT_AUTHENTICATED'
      using detail = 'You must be signed in to view your rank.';
  end if;

  if p_kind is null or p_kind not in ('return', 'value') then
    raise exception 'INVALID_KIND'
      using detail = 'Leaderboard kind must be ''return'' or ''value''.';
  end if;

  return query
    select r.rank, r.user_id, r.username, r.avatar_url, r.total_value, r.return_pct, r.trade_count
    from public._leaderboard_rows(p_kind) r
    where r.user_id = v_caller;
end;
$$;

revoke execute on function public.get_my_rank(text) from public;
revoke execute on function public.get_my_rank(text) from anon;
grant execute on function public.get_my_rank(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Small header stats for the leaderboards page: how many distinct traders
-- have ever traded, and how many trades happened today (server tz / UTC).
--
-- SECURITY INVOKER (the default -- no `security definer`): this reads only
-- public.trades, which every authenticated user can already read directly
-- (the trades table's SELECT policy is `using (true)` -- the public trade
-- tape), so it needs no elevated privileges. Same reasoning as
-- get_market_overview().
-- ---------------------------------------------------------------------------
create or replace function public.get_leaderboard_stats()
returns table (
  total_traders bigint,
  trades_today bigint
)
language sql
stable
set search_path = ''
as $$
  select
    (select count(distinct t.user_id) from public.trades t) as total_traders,
    (
      select count(*)
      from public.trades t
      where t.created_at >= date_trunc('day', now())
    ) as trades_today;
$$;

revoke execute on function public.get_leaderboard_stats() from public;
revoke execute on function public.get_leaderboard_stats() from anon;
grant execute on function public.get_leaderboard_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: let the leaderboards page subscribe to trade INSERTs so every
-- connected client can refetch (debounced) and see rank changes within
-- moments of any trade. Realtime still enforces RLS on delivery, and the
-- trades SELECT policy is already `using (true)` for authenticated (the
-- public tape), so this exposes nothing that isn't already readable.
--
-- `add table` has no `if not exists` variant, so guard it explicitly to keep
-- this migration re-run safe (same pattern as the markets/price_snapshots
-- publication adds in earlier migrations).
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'trades'
  ) then
    alter publication supabase_realtime add table public.trades;
  end if;
end;
$$;
