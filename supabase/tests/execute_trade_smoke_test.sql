-- =============================================================================
-- execute_trade smoke test
-- =============================================================================
-- Demonstrates a successful BUY, a successful SELL, and a REJECTED over-spend.
--
-- HOW TO RUN
--   1. In the `declare` section below, replace the two placeholder ids:
--        v_user_id   -> a profiles.id (its balance is read via the ledger)
--        v_artist_id -> an artists.id that HAS a market row
--      There is exactly ONE place to edit each id -- everything else in this
--      script references those two variables, so there is no way for a
--      leftover placeholder or a copy-paste mismatch to silently use the
--      wrong id in one statement but not another.
--   2. Run this whole file as the service_role / postgres user (e.g. via the
--      Supabase SQL editor, or the MCP execute_sql tool). As service_role,
--      auth.uid() is NULL so the in-function "trade only as yourself" assertion
--      is skipped -- exactly what you want for an admin-side smoke test.
--
-- WHY A SINGLE DO BLOCK (not one statement per step)
--   An earlier version of this script used top-level SAVEPOINT / ROLLBACK TO
--   SAVEPOINT statements to recover from the *expected* over-spend error. That
--   only works when each statement is sent to Postgres one at a time, as
--   interactive `psql` does. Both the Supabase SQL editor's "Run" button and
--   the MCP `execute_sql` tool submit the whole file as ONE multi-statement
--   batch -- and Postgres aborts every remaining statement in a batch the
--   instant one of them raises, so the recovery statements (and the final
--   ROLLBACK) never ran. The visible symptom was exactly a confusing
--   `INSUFFICIENT_BALANCE` error with no indication that the buy/sell steps
--   before it had already succeeded. Wrapping the whole demo -- including the
--   expected failure -- in one PL/pgSQL DO block sidesteps this entirely: to
--   the client it is a single statement, and the nested BEGIN/EXCEPTION block
--   below is plpgsql's own (client-independent) equivalent of a savepoint.
--
-- SAFETY: the entire script runs inside a transaction that ROLLS BACK at the
-- end, so it leaves no trace in your data. Change the final ROLLBACK to COMMIT
-- only if you deliberately want to persist these demo trades.
-- =============================================================================

begin;

do $$
declare
  v_user_id   uuid := '00000000-0000-0000-0000-000000000000'; -- <-- replace with a real profiles.id
  v_artist_id uuid := '11111111-1111-1111-1111-111111111111'; -- <-- replace with a real artists.id that has a market

  v_starting_balance numeric;
  v_buy_result json;
  v_sell_result json;
  v_shares_held numeric;
  v_final_balance numeric;
begin
  -- --- Preflight: fail loudly and clearly on a bad/unreplaced id, instead of
  -- letting a mismatch surface confusingly as INSUFFICIENT_BALANCE deep inside
  -- execute_trade. ---------------------------------------------------------
  if not exists (select 1 from public.profiles where id = v_user_id) then
    raise exception 'SMOKE TEST SETUP ERROR: % is not a real profiles.id -- replace v_user_id at the top of this script.', v_user_id;
  end if;

  if not exists (select 1 from public.markets where artist_id = v_artist_id) then
    raise exception 'SMOKE TEST SETUP ERROR: artist % has no market -- replace v_artist_id at the top of this script with an artists.id that HAS a market row.', v_artist_id;
  end if;

  v_starting_balance := public.get_token_balance(v_user_id);
  raise notice 'Starting balance for %: %', v_user_id, v_starting_balance;

  if v_starting_balance < 100 then
    raise exception 'SMOKE TEST SETUP ERROR: user % only has % tokens -- need at least 100 for this demo.', v_user_id, v_starting_balance;
  end if;

  -- --- 1. Successful BUY ---------------------------------------------------
  -- Spend 100 tokens on shares, accepting any non-negative amount out
  -- (p_min_receive = 0). Returns trade id, shares/tokens, prices, new balance.
  v_buy_result := public.execute_trade(v_user_id, v_artist_id, 'buy', 100, 0);
  raise notice 'PASS: buy succeeded -> %', v_buy_result;

  select shares into v_shares_held
  from public.holdings
  where user_id = v_user_id and artist_id = v_artist_id;
  raise notice 'Shares held after buy: %', v_shares_held;

  -- --- 2. Successful SELL ---------------------------------------------------
  -- Sell back every share we just bought, accepting any non-negative tokens out.
  v_sell_result := public.execute_trade(v_user_id, v_artist_id, 'sell', v_shares_held, 0);
  raise notice 'PASS: sell succeeded -> %', v_sell_result;

  v_final_balance := public.get_token_balance(v_user_id);
  raise notice 'Balance after round trip: % (started at %, cost ~ two 1%% fees)', v_final_balance, v_starting_balance;

  -- --- 3. REJECTED over-spend ------------------------------------------------
  -- Attempt to buy with far more tokens than the user could possibly hold.
  -- This MUST raise INSUFFICIENT_BALANCE. The nested BEGIN/EXCEPTION block is
  -- plpgsql's own savepoint mechanism, so the expected failure is handled
  -- right here -- no error ever escapes to the client on the happy path.
  begin
    perform public.execute_trade(v_user_id, v_artist_id, 'buy', 1000000000, 0);
    raise exception 'SMOKE TEST FAILED: over-spend was NOT rejected.';
  exception
    when others then
      if sqlerrm = 'INSUFFICIENT_BALANCE' then
        raise notice 'PASS: over-spend correctly rejected (INSUFFICIENT_BALANCE)';
      else
        raise; -- something other than the expected error: fail loudly
      end if;
  end;

  raise notice 'SMOKE TEST PASSED.';
end;
$$;

-- Leave no trace. Change to COMMIT to persist the demo trades instead.
rollback;
