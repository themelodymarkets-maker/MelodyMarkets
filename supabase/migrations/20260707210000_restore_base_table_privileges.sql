-- Restore the standard Supabase baseline table/sequence privileges for anon,
-- authenticated, and service_role in the public schema.
--
-- Discovered while building artist ingestion (see api/admin/seed route):
-- every table in this project was missing SELECT/INSERT/UPDATE/DELETE grants
-- for anon, authenticated, and service_role -- only REFERENCES/TRIGGER/
-- TRUNCATE were present. Postgres checks these SQL-level grants BEFORE row
-- level security policies are ever evaluated, so this silently blocked every
-- read (e.g. "Authenticated users can read artists") and every service-role
-- write, regardless of how correct the RLS policies were.
--
-- This does not weaken security: RLS remains the real gate for anon/
-- authenticated (every table already has `enable row level security`, and
-- most have no write policies at all), while service_role continues to
-- bypass RLS as intended for trusted server-side code. This migration only
-- restores the grant "ceiling" Supabase expects to exist on every project by
-- default, for both existing tables and any created in the future.
--
-- Deliberately scoped to TABLES and SEQUENCES only -- NOT routines/functions.
-- Earlier migrations intentionally revoked EXECUTE on `handle_new_user` and
-- `get_token_balance` for anon/public (and, for the former, authenticated
-- too); a blanket routine grant here would silently undo those lockdowns.
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public
  to anon, authenticated, service_role;

grant usage, select on all sequences in schema public
  to anon, authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;

alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
