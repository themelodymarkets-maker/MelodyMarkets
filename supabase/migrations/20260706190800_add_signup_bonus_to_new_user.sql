-- Extend the signup trigger so every new user also receives a starting balance.
--
-- This replaces public.handle_new_user() with an identical username-assignment
-- body, then appends one token_ledger credit of +10,000 tokens with reason
-- 'signup_bonus'. Both inserts run in the same trigger invocation (a single
-- transaction with the auth.users insert), so a new user always ends up with
-- exactly one profile row and exactly one signup-bonus ledger row.
--
-- Still SECURITY DEFINER with search_path pinned to '' so it can write to
-- tables that clients have no direct INSERT policy on. EXECUTE remains revoked
-- from client roles (see the earlier lock_down migration); triggers run with
-- the owner's privileges regardless.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Username requested in the signup metadata (may be null/blank).
  requested_username text;
  -- Sanitized base used to build a fallback username.
  base_username text;
  -- The username we will ultimately insert.
  final_username text;
begin
  -- Strip whitespace from the metadata username; treat blank as missing.
  requested_username := nullif(
    regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', ''), '\s', '', 'g'),
    ''
  );

  -- Happy path: a valid, length-appropriate, currently-free username was given.
  if requested_username is not null
     and char_length(requested_username) between 3 and 20
     and not exists (
       select 1 from public.profiles where username = requested_username
     )
  then
    final_username := requested_username;
  else
    -- Fallback: build from a sanitized email prefix plus random digits.
    base_username := lower(
      regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9]', '', 'gi')
    );

    -- Guarantee a sensible, length-safe base to append digits to.
    if char_length(base_username) < 3 then
      base_username := 'user';
    end if;
    base_username := left(base_username, 15);

    -- Try a 4-digit suffix first, then widen to 5 digits until unique.
    final_username := base_username || (floor(random() * 9000) + 1000)::int::text;
    while exists (
      select 1 from public.profiles where username = final_username
    ) loop
      final_username := base_username || (floor(random() * 90000) + 10000)::int::text;
    end loop;
  end if;

  insert into public.profiles (id, username)
  values (new.id, final_username);

  -- Grant the one-time signup bonus: +10,000 tokens. reference_id is left null
  -- because this is an internal event with no external idempotency key; there
  -- is exactly one such insert per new user by construction.
  insert into public.token_ledger (user_id, amount, reason)
  values (new.id, 10000, 'signup_bonus');

  return new;
end;
$$;
