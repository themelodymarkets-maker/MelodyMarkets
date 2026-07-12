-- Lightweight, database-backed rate limiting.
--
-- ===========================================================================
-- WHY IN-DATABASE (the chosen tradeoff)
-- ===========================================================================
-- MelodyMarkets runs on Vercel serverless functions. Any in-memory counter
-- (a Map in the Node process) is useless there: each cold invocation gets a
-- fresh, isolated instance, and warm instances are not shared between users
-- or regions, so an attacker's requests would rarely hit the same instance
-- and the limit would effectively never apply. A single shared source of
-- truth is required.
--
-- The two realistic options at this scale are an external store (e.g. Upstash
-- Redis) or the Postgres database we already run. We choose Postgres because:
--   * it adds NO new infrastructure, credentials, or monthly cost;
--   * the trade path already does a round trip to this same database, so one
--     extra sub-millisecond upsert is negligible;
--   * it is transactionally correct across every serverless instance at once.
-- The tradeoff vs. Redis is throughput: a SQL upsert per guarded request is
-- fine for this app's volume, but would need revisiting (move to Redis/edge)
-- if traffic grew by orders of magnitude. Callers treat this as best-effort
-- and FAIL OPEN (see src/lib/rate-limit.ts): if the limiter itself errors, the
-- request is allowed rather than blocking a legitimate user.
--
-- Strategy: a fixed-window counter. Each bucket (e.g. "trade:<user_id>" or
-- "checkout-ip:<ip>") tracks a window start and a hit count. When a request
-- arrives after the window has elapsed, the window resets to 1; otherwise the
-- count increments. `check_rate_limit` returns true while count <= max.

create table if not exists public.rate_limits (
  -- Opaque caller-supplied key: "<action>:<subject>" (never a secret).
  bucket text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 0
);

-- No RLS policies and no direct grants: this table is written ONLY through the
-- SECURITY DEFINER function below. Enabling RLS with zero policies means
-- anon/authenticated cannot read or write it directly, even though they hold
-- the baseline table grants restored in 20260707210000.
alter table public.rate_limits enable row level security;

-- Atomically record a hit against `p_key` and report whether it is still under
-- the limit. SECURITY DEFINER so callers never need direct table access;
-- search_path pinned to '' so the elevated context cannot be hijacked.
create or replace function public.check_rate_limit(
  p_key text,
  p_max integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window interval := make_interval(secs => p_window_seconds);
  v_count integer;
begin
  insert into public.rate_limits as rl (bucket, window_start, count)
  values (p_key, v_now, 1)
  on conflict (bucket) do update
    set
      count = case
        when rl.window_start < v_now - v_window then 1
        else rl.count + 1
      end,
      window_start = case
        when rl.window_start < v_now - v_window then v_now
        else rl.window_start
      end
  returning rl.count into v_count;

  return v_count <= p_max;
end;
$$;

-- Reachable by signed-in users (trade + checkout run as `authenticated`).
-- Revoke the implicit PUBLIC/anon grants so the definer function is not
-- callable unauthenticated.
revoke execute on function
  public.check_rate_limit(text, integer, integer) from public;
revoke execute on function
  public.check_rate_limit(text, integer, integer) from anon;
grant execute on function
  public.check_rate_limit(text, integer, integer) to authenticated;
