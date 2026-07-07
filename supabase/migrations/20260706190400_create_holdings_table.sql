-- Per-user, per-artist share positions.
--
-- One row summarizes how many shares a user currently holds in a given artist,
-- plus the cost basis used for return/P&L calculations. This is a derived
-- convenience table (the trades + ledger are the ground truth) kept in sync by
-- the trade functions in later milestones.
create table public.holdings (
  user_id uuid not null references public.profiles (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  -- Current share count. Can be fractional; never negative.
  shares numeric(30, 8) not null default 0 check (shares >= 0),
  -- Total tokens ever spent to acquire the currently-held shares, reduced
  -- proportionally when shares are sold. Used to compute unrealized return:
  -- current_value - total_cost_basis.
  total_cost_basis numeric(30, 8) not null default 0,
  updated_at timestamptz not null default now(),
  -- A user has exactly one position row per artist.
  primary key (user_id, artist_id)
);

-- Keep updated_at accurate as positions change.
create trigger holdings_set_updated_at
  before update on public.holdings
  for each row
  execute function public.set_updated_at();

alter table public.holdings enable row level security;

-- A user may read only their OWN holdings.
create policy "Users can read their own holdings"
  on public.holdings
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Note: no INSERT/UPDATE/DELETE policies. Positions are only mutated by
-- security-definer trade functions / the service role.
