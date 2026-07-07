-- Stop artist deletions from cascading into other users' financial history.
--
-- Previously, markets.artist_id, trades.artist_id, holdings.artist_id, and
-- price_snapshots.artist_id were all ON DELETE CASCADE. Because trades,
-- holdings, and price_snapshots hold data belonging to many different users
-- (not just whoever deletes the artist), deleting a single artists row would
-- silently wipe out other users' real trade history, positions, and chart
-- data. The roadmap already plans to retire artists via the `is_active` flag
-- rather than hard deletes, so removing cascade-delete here costs nothing
-- going forward and an artist can only be hard-deleted after its market,
-- trades, holdings, and price snapshots have been explicitly handled.
--
-- User-level cascades (profiles -> auth.users, and token_ledger/holdings/
-- trades -> profiles) are intentionally left untouched: those only ever
-- remove a single user's own data when that same user's account is deleted,
-- which is correct and expected.
alter table public.markets
  drop constraint markets_artist_id_fkey,
  add constraint markets_artist_id_fkey
    foreign key (artist_id) references public.artists (id) on delete restrict;

alter table public.trades
  drop constraint trades_artist_id_fkey,
  add constraint trades_artist_id_fkey
    foreign key (artist_id) references public.artists (id) on delete restrict;

alter table public.holdings
  drop constraint holdings_artist_id_fkey,
  add constraint holdings_artist_id_fkey
    foreign key (artist_id) references public.artists (id) on delete restrict;

alter table public.price_snapshots
  drop constraint price_snapshots_artist_id_fkey,
  add constraint price_snapshots_artist_id_fkey
    foreign key (artist_id) references public.artists (id) on delete restrict;
