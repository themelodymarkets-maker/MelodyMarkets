-- Compute a user's token balance from the append-only ledger.
--
-- Balance is defined as the sum of every ledger row for the user, coalesced to
-- 0 when the user has no entries yet. Marked STABLE (pure read within a
-- statement) and SECURITY DEFINER so it can total the ledger regardless of the
-- caller's row-level security view of token_ledger. search_path is pinned to ''
-- to prevent search-path hijacking.
create or replace function public.get_token_balance(p_user_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(amount), 0)
  from public.token_ledger
  where user_id = p_user_id;
$$;

-- Allow signed-in users to call it (e.g. to display their own balance).
grant execute on function public.get_token_balance(uuid) to authenticated;
