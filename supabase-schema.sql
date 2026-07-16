-- Orion Supabase schema
-- Run this once in your Supabase project's SQL editor (Dashboard -> SQL -> New query).

-- ---------------------------------------------------------------------------
-- chats: Orion inbox conversations (platform-owned — not OnlyFans).
-- Holds list metadata, transcript, and the last drafted reply.
-- ---------------------------------------------------------------------------
create table if not exists public.chats (
  id               text primary key,
  name             text,
  username         text,
  avatar           text,
  unread           integer default 0,
  last_message     text,
  last_message_at  timestamptz,
  messages         jsonb default '[]'::jsonb,
  suggestion       text default '',
  analyzed_at      timestamptz,
  updated_at       timestamptz default now()
);

create index if not exists chats_last_message_idx
  on public.chats (last_message_at desc nulls last);

-- ---------------------------------------------------------------------------
-- memory_profiles: AI journals. key = "default" for the Orion sandbox chat,
-- or "inbox:<chatId>" for each inbox conversation.
-- ---------------------------------------------------------------------------
create table if not exists public.memory_profiles (
  key                 text primary key,
  journal             jsonb default '[]'::jsonb,
  profile             text default '',
  last_scene_check_at timestamptz,
  updated_at          timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- app_settings: settings shared by the web app (e.g. the default persona).
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  key        text primary key,
  value      text default '',
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Storage bucket for photos/videos sent in web chats. Public read so the chat
-- page can display media; uploads go through signed URLs from the server.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('orion-media', 'orion-media', true)
on conflict (id) do nothing;

-- Optional: if you still have the old of_chats table from an earlier build,
-- you can migrate rows into chats then drop of_chats:
-- insert into public.chats (id, name, username, avatar, unread, last_message,
--   last_message_at, messages, suggestion, analyzed_at, updated_at)
-- select chat_id, name, username, avatar, unread, last_message, last_message_at,
--   messages, suggestion, analyzed_at, updated_at
-- from public.of_chats
-- on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Row Level Security: SERVICE ROLE key bypasses RLS (recommended for a
-- personal desktop tool). For ANON key, enable RLS + permissive policies:
-- ---------------------------------------------------------------------------
-- alter table public.chats enable row level security;
-- alter table public.memory_profiles enable row level security;
-- create policy "orion chats access" on public.chats
--   for all using (true) with check (true);
-- create policy "orion memory access" on public.memory_profiles
--   for all using (true) with check (true);
