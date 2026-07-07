-- One market per artist: a constant-product automated market maker (AMM).
--
-- INVARIANT / ECONOMIC DESIGN
-- ---------------------------------------------------------------------------
-- Each market holds two reserves:
--   * token_reserve  -- MelodyMarkets tokens held by the pool
--   * share_reserve  -- artist shares held by the pool
--
-- The spot price of one share, denominated in tokens, is:
--
--     price = token_reserve / share_reserve
--
-- Trades follow the constant-product rule: the product
--
--     k = token_reserve * share_reserve
--
-- stays constant across every trade (ignoring fees). Buying shares removes
-- shares from the pool and adds tokens, which pushes token_reserve up and
-- share_reserve down, so the price rises; selling does the reverse. Because
-- both reserves must always be strictly positive, the price is always defined
-- and can never hit zero or divide by zero.
--
-- Both reserves are numeric(30,8) to keep 8 decimal places of precision with
-- plenty of headroom, and both carry a strict > 0 check constraint to protect
-- the invariant.
create table public.markets (
  id uuid primary key default gen_random_uuid(),
  -- Exactly one market per artist. Cascade so delisting an artist row (rare)
  -- also removes its market.
  artist_id uuid not null unique references public.artists (id) on delete cascade,
  token_reserve numeric(30, 8) not null check (token_reserve > 0),
  share_reserve numeric(30, 8) not null check (share_reserve > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at accurate as reserves change with each trade.
create trigger markets_set_updated_at
  before update on public.markets
  for each row
  execute function public.set_updated_at();

alter table public.markets enable row level security;

-- Any authenticated user may read market state (needed to quote prices).
create policy "Authenticated users can read markets"
  on public.markets
  for select
  to authenticated
  using (true);

-- Note: no INSERT/UPDATE/DELETE policies. Reserves are only ever mutated by
-- security-definer trade functions / the service role.
