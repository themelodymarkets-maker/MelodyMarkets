-- Append-only token ledger: the single source of truth for token balances.
--
-- Every token movement in MelodyMarkets is recorded here as an immutable row.
-- A user's balance is simply the sum of their rows (see get_token_balance()).
-- There are deliberately NO update or delete policies on this table -- EVER.
-- Corrections are made by appending compensating entries, never by editing
-- history. This makes the ledger auditable and reconciliation trivial.
create table public.token_ledger (
  id bigint generated always as identity primary key,
  -- Owner of this entry. References the public profile (1:1 with auth user).
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Signed token delta: positive = credit (tokens in), negative = debit (out).
  amount numeric(30, 8) not null,
  -- Why this entry exists. Constrained to a fixed vocabulary so balances can be
  -- attributed to known flows.
  reason text not null check (
    reason in ('signup_bonus', 'trade_buy', 'trade_sell', 'stripe_purchase')
  ),
  -- Optional external reference used for idempotency, e.g. a Stripe event id or
  -- a trade id. See the partial unique index below.
  reference_id text,
  created_at timestamptz not null default now()
);

-- Idempotency guard: a given (reason, reference_id) pair can appear at most
-- once. This makes it impossible to credit the same external event (e.g. a
-- Stripe webhook retry) twice. NULL reference_ids are excluded so that entries
-- without an external reference (e.g. signup bonuses) are not constrained.
create unique index token_ledger_reason_reference_id_key
  on public.token_ledger (reason, reference_id)
  where reference_id is not null;

-- Fast per-user balance scans.
create index token_ledger_user_id_created_at_idx
  on public.token_ledger (user_id, created_at);

alter table public.token_ledger enable row level security;

-- A user may read only their OWN ledger rows.
create policy "Users can read their own ledger entries"
  on public.token_ledger
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Note: there are intentionally NO insert, update, or delete policies. The
-- ledger is append-only and writes happen exclusively through security-definer
-- functions / the service role. History is never mutated.
