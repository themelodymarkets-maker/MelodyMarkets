-- Immutable log of every executed trade against a market.
--
-- Each row records a single buy or sell: how many shares changed hands, how
-- many tokens moved, and the effective price per share at execution time.
create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  -- Direction of the trade from the user's perspective.
  side text not null check (side in ('buy', 'sell')),
  -- Shares acquired (buy) or disposed (sell).
  shares numeric(30, 8) not null,
  -- Tokens paid (buy) or received (sell).
  tokens numeric(30, 8) not null,
  -- Effective execution price = tokens / shares, stored for convenience.
  price_per_share numeric(30, 8) not null,
  created_at timestamptz not null default now()
);

-- Chart / market activity feeds: recent trades for an artist.
create index trades_artist_id_created_at_idx
  on public.trades (artist_id, created_at);

-- Portfolio / activity feeds: a user's own trade history.
create index trades_user_id_created_at_idx
  on public.trades (user_id, created_at);

alter table public.trades enable row level security;

-- Any authenticated user may read the trade tape freely (public market data).
create policy "Authenticated users can read trades"
  on public.trades
  for select
  to authenticated
  using (true);

-- Note: no INSERT/UPDATE/DELETE policies. Trades are written only by
-- security-definer trade functions / the service role, and are never edited.
