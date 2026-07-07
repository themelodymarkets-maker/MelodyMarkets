-- Artists are the tradable assets of MelodyMarkets.
--
-- Design note: this table is intentionally generic. MelodyMarkets may later
-- list other tradable things (e.g. genre indexes or playlists) alongside
-- artists. When that happens, add an `asset_type text` column (defaulting to
-- 'artist') rather than creating a parallel table. Keep all queries written
-- against this table generic (filter by id/slug, not by "artist-ness") so that
-- expansion is a purely additive migration.
create table public.artists (
  id uuid primary key default gen_random_uuid(),
  -- Human-readable artist name (may contain spaces, punctuation, etc.).
  name text not null,
  -- URL-safe identifier used in routes like /artists/<slug>. Unique.
  slug text not null unique,
  -- Canonical Last.fm artist name used to sync listeners/playcount. Unique.
  lastfm_name text not null unique,
  -- Optional promotional / avatar image.
  image_url text,
  -- Optional free-text primary genre.
  genre text,
  -- Latest known Last.fm audience metrics (nullable until first sync).
  listeners bigint,
  playcount bigint,
  -- Soft on/off switch so an artist can be delisted without deleting history.
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at accurate on every change.
create trigger artists_set_updated_at
  before update on public.artists
  for each row
  execute function public.set_updated_at();

-- Lock down: no access until a policy grants it.
alter table public.artists enable row level security;

-- Any authenticated user may browse the full artist catalog.
create policy "Authenticated users can read artists"
  on public.artists
  for select
  to authenticated
  using (true);

-- Note: no INSERT/UPDATE/DELETE policies. Clients can never write here directly.
-- Artist ingestion happens via the service-role key / security-definer
-- functions in later milestones.
