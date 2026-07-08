-- The atomic trade engine: the ONLY sanctioned path for economic writes.
--
-- ===========================================================================
-- WHY THIS FUNCTION EXISTS / SECURITY MODEL
-- ===========================================================================
-- Every token- and share-moving write in MelodyMarkets funnels through this
-- one function. Clients can NEVER write markets / holdings / token_ledger /
-- trades / price_snapshots directly -- those tables have no INSERT/UPDATE/
-- DELETE policies at all (see their migrations). Instead the app calls this
-- SECURITY DEFINER function, which runs with the owner's privileges and does
-- every mutation inside a single implicit transaction (a plpgsql function
-- body is atomic: if any statement raises, the whole trade rolls back and the
-- reserves, ledger, holdings, trade tape, and price history stay perfectly
-- consistent -- there is no such thing as a half-applied trade).
--
-- search_path is pinned to '' so a malicious caller cannot shadow `public`
-- with their own objects and hijack the elevated definer context; every
-- reference below is therefore schema-qualified.
--
-- CALLER IDENTITY: EXECUTE is granted only to `authenticated` (and, for
-- trusted server code, service_role bypasses RLS entirely). When invoked with
-- a real user JWT, auth.uid() is that user's id, and we assert
-- p_user_id = auth.uid() -- so a signed-in user can only ever trade as
-- themselves, never on behalf of someone else. When invoked by service_role
-- (server-side jobs / tests) auth.uid() is NULL and the assertion is skipped.
--
-- ===========================================================================
-- ECONOMIC DESIGN (constant-product AMM + 1% fee)
-- ===========================================================================
-- Each market holds two reserves; spot price = token_reserve / share_reserve
-- and the product k = token_reserve * share_reserve is conserved by trades
-- (ignoring fees). See 20260706190200_create_markets_table.sql.
--
-- THE 1% FEE DEEPENS LIQUIDITY. On every trade a 1% fee is skimmed from the
-- user-facing side of the swap, but that fee is NEVER paid out -- it stays in
-- the pool's reserves. Concretely:
--   * BUY: the user spends `amount` tokens. Only amount*0.99 is used to price
--     the swap (effective_tokens_in), yet the FULL `amount` is added to
--     token_reserve. The extra 1% therefore accretes to the pool.
--   * SELL: the swap prices out tokens_out_gross tokens, but the user only
--     receives tokens_out_gross*0.99. token_reserve is reduced by only the
--     net amount actually paid out, so the withheld 1% stays in the pool.
-- Because the withheld fee never leaves the reserves, k ratchets upward over
-- time: liquidity deepens and slippage shrinks for everyone. The fee is a
-- protocol-owned liquidity contribution, not a payout to any account.
--
-- ===========================================================================
-- CONCURRENCY
-- ===========================================================================
-- The very first data statement is SELECT ... FOR UPDATE on the market row.
-- That row lock serializes every concurrent trade against the same artist:
-- the second trade blocks until the first commits, then re-reads the already
-- updated reserves. This makes the read-modify-write on reserves race-free.
-- The caller's holdings row is then also locked FOR UPDATE (created first if
-- absent) so concurrent trades by the same user on the same artist serialize
-- too.

create or replace function public.execute_trade(
  p_user_id uuid,
  p_artist_id uuid,
  p_side text,
  p_amount numeric,
  p_min_receive numeric
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Fee retained in the pool on every trade (1%). effective factor = 0.99.
  c_fee_factor constant numeric := 0.99;

  v_caller uuid := auth.uid();

  v_market_id uuid;
  v_token_reserve numeric(30, 8);
  v_share_reserve numeric(30, 8);

  v_holding_shares numeric(30, 8);
  v_holding_cost numeric(30, 8);

  v_balance numeric;

  -- Outcome of the swap (what actually happened, from the user's view).
  v_shares numeric(30, 8);   -- shares that changed hands
  v_tokens numeric(30, 8);   -- tokens that changed hands (gross for buy, net for sell)
  v_price_per_share numeric(30, 8);

  -- Post-trade reserves.
  v_new_token_reserve numeric(30, 8);
  v_new_share_reserve numeric(30, 8);
  v_new_price numeric(30, 8);

  v_effective_in numeric;    -- buy: fee-adjusted tokens used to price the swap
  v_tokens_gross numeric;    -- sell: pre-fee tokens the swap prices out

  v_trade_id uuid;
  v_new_balance numeric;
begin
  -- --- 0. Identity + argument validation -----------------------------------
  -- A signed-in user may only trade as themselves. service_role (auth.uid()
  -- IS NULL) is trusted and may act for any user.
  if v_caller is not null and v_caller <> p_user_id then
    raise exception 'FORBIDDEN_USER'
      using detail = 'You can only execute trades as the authenticated user.';
  end if;

  if p_side is null or p_side not in ('buy', 'sell') then
    raise exception 'INVALID_SIDE'
      using detail = 'Trade side must be either ''buy'' or ''sell''.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT'
      using detail = 'Trade amount must be a positive number.';
  end if;

  -- --- 1. Lock the market (serializes all trades for this artist) ----------
  select id, token_reserve, share_reserve
    into v_market_id, v_token_reserve, v_share_reserve
  from public.markets
  where artist_id = p_artist_id
  for update;

  if not found then
    raise exception 'UNKNOWN_MARKET'
      using detail = 'No market exists for the requested artist.';
  end if;

  -- --- 2. Lock the caller's holdings row (create it first if absent) -------
  -- The insert is a no-op when the row already exists; the subsequent
  -- SELECT ... FOR UPDATE always finds and locks exactly one row.
  insert into public.holdings (user_id, artist_id, shares, total_cost_basis)
  values (p_user_id, p_artist_id, 0, 0)
  on conflict (user_id, artist_id) do nothing;

  select shares, total_cost_basis
    into v_holding_shares, v_holding_cost
  from public.holdings
  where user_id = p_user_id and artist_id = p_artist_id
  for update;

  if p_side = 'buy' then
    -- ===================================================================
    -- BUY: p_amount = tokens the user wants to spend.
    -- ===================================================================
    v_balance := public.get_token_balance(p_user_id);
    if v_balance < p_amount then
      raise exception 'INSUFFICIENT_BALANCE'
        using detail = 'Token balance is too low to cover this purchase.';
    end if;

    -- Only 99% of the spend prices the swap; the withheld 1% still enters
    -- the pool (see fee note in the header), deepening liquidity.
    v_effective_in := p_amount * c_fee_factor;

    -- Constant-product output.
    v_shares := v_share_reserve
      - (v_token_reserve * v_share_reserve) / (v_token_reserve + v_effective_in);

    if v_shares < p_min_receive then
      raise exception 'SLIPPAGE_EXCEEDED'
        using detail = 'Shares received would be below the requested minimum.';
    end if;

    v_tokens := p_amount;                         -- full spend
    v_price_per_share := v_tokens / v_shares;

    -- Full spend enters the pool; only the swap output leaves it.
    v_new_token_reserve := v_token_reserve + p_amount;
    v_new_share_reserve := v_share_reserve - v_shares;
  else
    -- ===================================================================
    -- SELL: p_amount = shares the user wants to sell.
    -- ===================================================================
    if v_holding_shares < p_amount then
      raise exception 'INSUFFICIENT_SHARES'
        using detail = 'You do not hold enough shares to sell this amount.';
    end if;

    -- Constant-product gross proceeds, then skim the 1% fee (kept in pool).
    v_tokens_gross := v_token_reserve
      - (v_token_reserve * v_share_reserve) / (v_share_reserve + p_amount);
    v_tokens := v_tokens_gross * c_fee_factor;

    if v_tokens < p_min_receive then
      raise exception 'SLIPPAGE_EXCEEDED'
        using detail = 'Tokens received would be below the requested minimum.';
    end if;

    v_shares := p_amount;
    v_price_per_share := v_tokens / v_shares;

    -- Shares return to the pool; only the NET tokens paid out leave it, so
    -- the withheld 1% fee stays in token_reserve.
    v_new_share_reserve := v_share_reserve + p_amount;
    v_new_token_reserve := v_token_reserve - v_tokens;
  end if;

  v_new_price := v_new_token_reserve / v_new_share_reserve;

  -- --- 3. Persist the trade (id needed as the ledger reference) ------------
  insert into public.trades (user_id, artist_id, side, shares, tokens, price_per_share)
  values (p_user_id, p_artist_id, p_side, v_shares, v_tokens, v_price_per_share)
  returning id into v_trade_id;

  -- --- 4. Ledger entry (append-only source of truth for balances) ---------
  -- reference_id = trade id makes the ledger row idempotent and traceable
  -- back to the exact trade that produced it.
  if p_side = 'buy' then
    insert into public.token_ledger (user_id, amount, reason, reference_id)
    values (p_user_id, -v_tokens, 'trade_buy', v_trade_id::text);
  else
    insert into public.token_ledger (user_id, amount, reason, reference_id)
    values (p_user_id, v_tokens, 'trade_sell', v_trade_id::text);
  end if;

  -- --- 5. Move the reserves -----------------------------------------------
  update public.markets
  set token_reserve = v_new_token_reserve,
      share_reserve = v_new_share_reserve
  where id = v_market_id;

  -- --- 6. Update the caller's position -------------------------------------
  if p_side = 'buy' then
    update public.holdings
    set shares = v_holding_shares + v_shares,
        total_cost_basis = v_holding_cost + v_tokens
    where user_id = p_user_id and artist_id = p_artist_id;
  else
    -- Reduce cost basis by the fraction of shares sold, so the remaining
    -- basis still reflects the average cost of the shares still held.
    update public.holdings
    set shares = v_holding_shares - v_shares,
        total_cost_basis = v_holding_cost * (1 - v_shares / v_holding_shares)
    where user_id = p_user_id and artist_id = p_artist_id;
  end if;

  -- --- 7. Record the new price on the chart -------------------------------
  insert into public.price_snapshots (artist_id, price, source)
  values (p_artist_id, v_new_price, 'trade');

  v_new_balance := public.get_token_balance(p_user_id);

  return json_build_object(
    'trade_id', v_trade_id,
    'side', p_side,
    'shares', v_shares,
    'tokens', v_tokens,
    'price_per_share', v_price_per_share,
    'market_price', v_new_price,
    'token_balance', v_new_balance
  );
end;
$$;

-- Signed-in users call this to trade (the in-body auth.uid() assertion keeps
-- them acting only as themselves). Revoke the default PUBLIC grant and anon so
-- the elevated definer function is never reachable unauthenticated.
revoke execute on function
  public.execute_trade(uuid, uuid, text, numeric, numeric) from public;
revoke execute on function
  public.execute_trade(uuid, uuid, text, numeric, numeric) from anon;
grant execute on function
  public.execute_trade(uuid, uuid, text, numeric, numeric) to authenticated;
