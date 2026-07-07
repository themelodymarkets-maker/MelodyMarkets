-- Shared utility: keep an `updated_at` column current on every UPDATE.
--
-- Several tables in this milestone (artists, markets, holdings) carry an
-- `updated_at timestamptz`. Rather than repeat the same logic, they all attach
-- a BEFORE UPDATE trigger that calls this one function. search_path is pinned
-- to '' to avoid search-path hijacking; the function only touches the NEW row.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
