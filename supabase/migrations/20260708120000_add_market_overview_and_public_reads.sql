-- Powers the production /markets watchlist: one function that returns every
-- active artist's current price and 24h-ago reference price in a single
-- round trip, plus the read access that page needs to actually render for
-- signed-out visitors.
--
-- ---------------------------------------------------------------------------
-- 1. get_market_overview()
-- ---------------------------------------------------------------------------
-- Per active artist this needs: current spot price (token_reserve /
-- share_reserve) and a 24h-ago reference price to compute the change pill.
-- Doing the reference-price lookup with N+1 client queries (or fetching all
-- price_snapshots rows and reducing in JS) does not scale, so this function
-- does it once per artist inside Postgres via two LATERAL subqueries, both
-- backed by the existing price_snapshots(artist_id, created_at) index.
--
-- Reference price rule: the most recent snapshot strictly older than 24
-- hours, or -- if the artist has no snapshot that old yet (e.g. a freshly
-- listed artist) -- its oldest snapshot instead, so a change pill is always
-- computable rather than null on day one.
--
-- SECURITY INVOKER (the default -- no `security definer` here) is correct:
-- this function only reads tables the caller can already read directly
-- (artists, markets, price_snapshots), so it runs with the caller's own
-- privileges instead of elevating them.
create or replace function public.get_market_overview()
returns table (
  artist_id uuid,
  slug text,
  name text,
  genre text,
  image_url text,
  listeners bigint,
  current_price numeric,
  reference_price numeric
)
language sql
stable
set search_path = ''
as $$
  select
    a.id as artist_id,
    a.slug,
    a.name,
    a.genre,
    a.image_url,
    a.listeners,
    m.token_reserve / m.share_reserve as current_price,
    coalesce(recent_snapshot.price, oldest_snapshot.price) as reference_price
  from public.artists a
  join public.markets m on m.artist_id = a.id
  left join lateral (
    select ps.price
    from public.price_snapshots ps
    where ps.artist_id = a.id
      and ps.created_at <= now() - interval '24 hours'
    order by ps.created_at desc
    limit 1
  ) recent_snapshot on true
  left join lateral (
    select ps.price
    from public.price_snapshots ps
    where ps.artist_id = a.id
    order by ps.created_at asc
    limit 1
  ) oldest_snapshot on true
  where a.is_active
  order by a.listeners desc nulls last;
$$;

-- Same read audience as the tables it queries (see policies below): any
-- signed-in user, plus anon so the watchlist works before signing up.
grant execute on function public.get_market_overview() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Public read access for the watchlist
-- ---------------------------------------------------------------------------
-- /markets is not behind the auth gate in src/lib/supabase/middleware.ts, and
-- the landing page's primary "Explore Markets" call-to-action links there for
-- signed-out visitors too. But artists/markets/price_snapshots previously had
-- read policies scoped to `authenticated` only, so every signed-out visitor
-- following that link would hit RLS and see an empty page. Add read-only
-- `anon` policies alongside the existing `authenticated` ones so the public
-- watchlist actually renders for its intended audience; this is read-only
-- market data with no write policies and no PII, so widening SELECT access
-- carries no meaningful risk.
create policy "Anonymous users can read artists"
  on public.artists
  for select
  to anon
  using (true);

create policy "Anonymous users can read markets"
  on public.markets
  for select
  to anon
  using (true);

create policy "Anonymous users can read price snapshots"
  on public.price_snapshots
  for select
  to anon
  using (true);

-- ---------------------------------------------------------------------------
-- 3. Realtime
-- ---------------------------------------------------------------------------
-- The markets page subscribes to postgres_changes on public.markets to flash
-- prices in place as reserves move. `add table` has no `if not exists`
-- variant, so guard it explicitly to keep this migration re-run safe.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'markets'
  ) then
    alter publication supabase_realtime add table public.markets;
  end if;
end;
$$;
