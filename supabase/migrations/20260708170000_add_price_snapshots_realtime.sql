-- Lets clients subscribe to postgres_changes INSERTs on price_snapshots, so
-- the price chart can append a live point the moment a real trade (or the
-- daily cron) records one -- rather than ever fabricating one client-side.
--
-- `add table` has no `if not exists` variant, so guard it explicitly to keep
-- this migration re-run safe (same pattern as the `markets` publication add
-- in 20260708120000_add_market_overview_and_public_reads.sql).
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'price_snapshots'
  ) then
    alter publication supabase_realtime add table public.price_snapshots;
  end if;
end;
$$;
