-- Create the public profiles table.
-- Each row is the public identity of a Supabase auth user. The primary key
-- is the same uuid as the auth.users row, and deleting the auth user cascades
-- to remove their profile automatically.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Public display name. Unique across the app and constrained to 3-20 chars.
  username text not null unique
    check (char_length(username) between 3 and 20),
  -- Optional link to an avatar image.
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Lock the table down: no access is allowed until a policy explicitly grants it.
alter table public.profiles enable row level security;

-- Any authenticated user may read every profile (needed later for leaderboards).
create policy "Authenticated users can read all profiles"
  on public.profiles
  for select
  to authenticated
  using (true);

-- A user may update only their own profile row.
create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Note: no INSERT or DELETE policies are defined, so clients cannot insert or
-- delete profiles directly. Profile creation is handled server-side by the
-- on-signup trigger (see the next migration).
