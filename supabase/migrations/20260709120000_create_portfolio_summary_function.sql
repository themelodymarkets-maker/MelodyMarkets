-- Central definition of "portfolio value" and "total return %".
--
-- ===========================================================================
-- WHY THIS FUNCTION EXISTS
-- ===========================================================================
-- The /portfolio page and (later) the leaderboard both need to answer "how
-- is this user doing overall?", and that answer must be computed identically
-- everywhere it appears. Rather than duplicating the formula in every caller,
-- it lives here, exactly once, as the single source of truth. The
-- TypeScript in src/app/portfolio/page.tsx and
-- src/components/portfolio/PortfolioView.tsx re-derives the SAME formulas
-- client-side purely so the page can re-render live as market prices move
-- over Realtime (see that component's header comment) -- this function
-- remains the authority or "grading key" those numbers are checked against.
--
-- ===========================================================================
-- DEFINITIONS
-- ===========================================================================
-- Per position (one row in `holdings`):
--   * current price          = token_reserve / share_reserve for that
--                               artist's market (see
--                               20260706190200_create_markets_table.sql for
--                               the AMM invariant this implements)
--   * position market value  = shares * current price
--   * average cost           = total_cost_basis / shares
--   * position unrealized PL = position market value - total_cost_basis
--
-- Per user (aggregated across every position, this function):
--   * token_balance   = sum of the user's token_ledger rows (identical
--                        definition to get_token_balance(); see
--                        20260706190700_create_get_token_balance_function.sql)
--   * holdings_value  = sum of every position's market value
--   * total_value     = token_balance + holdings_value
--   * total_credited  = sum of token_ledger rows the user was ever GIVEN --
--                        reason in ('signup_bonus', 'stripe_purchase') --
--                        as opposed to tokens earned or lost trading. This is
--                        the "cost basis" for the account as a whole: what
--                        the user put in (for free, via signup, or by
--                        paying), independent of how trading has since gone.
--   * return_pct      = (total_value - total_credited) / total_credited * 100
--                        i.e. how much the account has grown (or shrunk)
--                        relative to everything it was ever credited.
--                        Defined as 0 when total_credited is 0 to avoid
--                        dividing by zero -- an edge case that should not
--                        occur in practice since every account receives a
--                        signup bonus (see
--                        20260706190800_add_signup_bonus_to_new_user.sql).
--
-- ===========================================================================
-- SECURITY MODEL
-- ===========================================================================
-- SECURITY DEFINER because totaling token_ledger and holdings requires
-- reading every row for a user regardless of the caller's own RLS-visible
-- slice -- identical rationale to get_token_balance(). search_path is pinned
-- to '' so every reference below is schema-qualified and cannot be hijacked.
--
-- A signed-in user may only ever request their OWN summary: the in-body
-- auth.uid() check mirrors execute_trade()'s "trade only as yourself" guard.
-- service_role (auth.uid() IS NULL, e.g. a future leaderboard cron job) is
-- trusted and may request any user's summary -- that job would call this
-- function once per user to build a ranked list, reusing this exact formula
-- rather than reimplementing it.
create or replace function public.get_portfolio_summary(p_user_id uuid)
returns table (
  user_id uuid,
  token_balance numeric,
  holdings_value numeric,
  total_value numeric,
  total_credited numeric,
  return_pct numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'FORBIDDEN_USER'
      using detail = 'You can only view your own portfolio summary.';
  end if;

  return query
  with balance as (
    select coalesce(sum(tl.amount), 0) as value
    from public.token_ledger tl
    where tl.user_id = p_user_id
  ),
  credited as (
    select coalesce(sum(tl.amount), 0) as value
    from public.token_ledger tl
    where tl.user_id = p_user_id
      and tl.reason in ('signup_bonus', 'stripe_purchase')
  ),
  holdings_total as (
    select coalesce(sum(h.shares * (m.token_reserve / m.share_reserve)), 0) as value
    from public.holdings h
    join public.markets m on m.artist_id = h.artist_id
    where h.user_id = p_user_id
      and h.shares > 0
  )
  select
    p_user_id,
    balance.value,
    holdings_total.value,
    balance.value + holdings_total.value,
    credited.value,
    case
      when credited.value > 0
        then ((balance.value + holdings_total.value) - credited.value) / credited.value * 100
      else 0
    end
  from balance, credited, holdings_total;
end;
$$;

-- Same "signed-in users only" audience as get_token_balance(); explicitly
-- revoke the default PUBLIC grant (and anon) before granting to authenticated
-- so this SECURITY DEFINER function is never reachable unauthenticated.
revoke execute on function public.get_portfolio_summary(uuid) from public;
revoke execute on function public.get_portfolio_summary(uuid) from anon;
grant execute on function public.get_portfolio_summary(uuid) to authenticated;
