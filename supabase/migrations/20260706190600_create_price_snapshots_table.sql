-- Append-only price history: the ONLY source of chart data.
--
-- Every point plotted on an artist's price chart comes from a row here. Prices
-- are recorded either right after a trade moves the market ('trade') or by a
-- periodic job that samples the current price on a fixed cadence ('cron').
-- History is always real and recorded as it happened -- it is never fabricated,
-- back-filled, or interpolated.
create table public.price_snapshots (
  id bigint generated always as identity primary key,
  artist_id uuid not null references public.artists (id) on delete cascade,
  -- Spot price (token_reserve / share_reserve) at the moment of the snapshot.
  price numeric(30, 8) not null,
  -- What caused this snapshot to be recorded.
  source text not null check (source in ('trade', 'cron')),
  created_at timestamptz not null default now()
);

-- Time-series scans for a given artist's chart.
create index price_snapshots_artist_id_created_at_idx
  on public.price_snapshots (artist_id, created_at);

alter table public.price_snapshots enable row level security;

-- Any authenticated user may read price history freely (public chart data).
create policy "Authenticated users can read price snapshots"
  on public.price_snapshots
  for select
  to authenticated
  using (true);

-- Note: no INSERT/UPDATE/DELETE policies. Snapshots are written only by
-- security-definer functions / the service role, and are never edited.
