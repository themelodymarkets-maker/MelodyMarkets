-- Harden get_token_balance().
--
-- Because it is SECURITY DEFINER, it reads the token_ledger with the owner's
-- privileges, bypassing row-level security. By default Postgres grants EXECUTE
-- to PUBLIC, which would let the anonymous (unauthenticated) role total any
-- user's balance via /rest/v1/rpc/get_token_balance. Revoke the blanket grants
-- and keep EXECUTE only for signed-in users (granted in the previous migration).
revoke execute on function public.get_token_balance(uuid) from public;
revoke execute on function public.get_token_balance(uuid) from anon;
