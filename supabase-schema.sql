-- Zgram database schema for Supabase
-- Run this in your Supabase project's SQL Editor (Database > SQL Editor > New query)

-- ---------- PROFILES ----------
create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  name text not null,
  bio text default '',
  avatar text,
  followers jsonb default '[]'::jsonb,
  following jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

-- Anyone logged in can view any profile (needed for feed, search, follows)
create policy "profiles are viewable by authenticated users"
  on profiles for select
  to authenticated
  using (true);

-- You can only create your own profile row
create policy "users can insert their own profile"
  on profiles for insert
  to authenticated
  with check (auth.uid() = user_id);

-- You can only edit your own profile
create policy "users can update their own profile"
  on profiles for update
  to authenticated
  using (auth.uid() = user_id);

-- ---------- POSTS ----------
create table posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  username text not null,
  image text not null,
  caption text default '',
  likes jsonb default '[]'::jsonb,
  saved_by jsonb default '[]'::jsonb,
  comments jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

alter table posts enable row level security;

create policy "posts are viewable by authenticated users"
  on posts for select
  to authenticated
  using (true);

create policy "users can insert their own posts"
  on posts for insert
  to authenticated
  with check (auth.uid() = user_id);

-- NOTE: likes/saves/comments need OTHER users to update this row (e.g. someone
-- else liking your post). A simple update policy has to allow that. This is a
-- deliberate simplification for a learning project: it means, in theory, any
-- logged-in user could rewrite another user's caption via a raw API call, not
-- just the likes/comments fields. The correct production fix is a Postgres
-- function (SECURITY DEFINER RPC) that only lets callers touch the
-- likes/saved_by/comments columns. Good next step once this is live.
create policy "authenticated users can update posts"
  on posts for update
  to authenticated
  using (true);

create policy "users can delete their own posts"
  on posts for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------- REELS ----------
create table reels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  username text not null,
  video text not null,
  caption text default '',
  likes jsonb default '[]'::jsonb,
  comments jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

alter table reels enable row level security;

create policy "reels are viewable by authenticated users"
  on reels for select
  to authenticated
  using (true);

create policy "users can insert their own reels"
  on reels for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Same simplification/tradeoff as posts above.
create policy "authenticated users can update reels"
  on reels for update
  to authenticated
  using (true);

create policy "users can delete their own reels"
  on reels for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------- MESSAGES (DMs) ----------
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null,
  sender_id uuid references auth.users(id) on delete cascade,
  sender_username text not null,
  receiver_id uuid references auth.users(id) on delete cascade,
  receiver_username text not null,
  text text not null,
  created_at timestamptz default now()
);

alter table messages enable row level security;

create index messages_conversation_idx on messages (conversation_id, created_at);

-- You can only see messages you sent or received
create policy "users can view their own messages"
  on messages for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- You can only send messages as yourself
create policy "users can send messages as themselves"
  on messages for insert
  to authenticated
  with check (auth.uid() = sender_id);
