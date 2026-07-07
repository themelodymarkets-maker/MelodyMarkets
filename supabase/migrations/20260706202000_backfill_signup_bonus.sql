-- Backfill the signup bonus for profiles created before the token_ledger /
-- signup-bonus trigger existed.
--
-- reference_id is set to the profile's id (as text) specifically so this
-- migration is idempotent: the partial unique index on
-- (reason, reference_id) where reference_id is not null guarantees a second
-- run of this INSERT ... SELECT finds every affected profile already covered
-- by the NOT EXISTS check and inserts nothing. This mirrors how reference_id
-- is used to dedupe Stripe events elsewhere in the ledger.
insert into public.token_ledger (user_id, amount, reason, reference_id)
select p.id, 10000, 'signup_bonus', p.id::text
from public.profiles p
where not exists (
  select 1
  from public.token_ledger l
  where l.user_id = p.id
    and l.reason = 'signup_bonus'
);
