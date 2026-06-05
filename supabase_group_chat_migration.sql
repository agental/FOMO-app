-- ══════════════════════════════════════════════
--  Group Chat Migration — run in Supabase SQL editor
-- ══════════════════════════════════════════════

-- 1. Group channels (one per country+city)
CREATE TABLE IF NOT EXISTS group_channels (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  country_code text NOT NULL,
  city_slug    text NOT NULL,
  city_name    text NOT NULL,
  city_emoji   text DEFAULT '🌍',
  created_at   timestamptz DEFAULT now(),
  UNIQUE(country_code, city_slug)
);

-- 2. Group messages
CREATE TABLE IF NOT EXISTS group_messages (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id    uuid REFERENCES group_channels(id) ON DELETE CASCADE NOT NULL,
  user_id       text NOT NULL,
  display_name  text NOT NULL,
  avatar_url    text,
  content       text,
  type          text DEFAULT 'text' CHECK (type IN ('text','image','location')),
  image_url     text,
  location_lat  double precision,
  location_lng  double precision,
  location_name text,
  created_at    timestamptz DEFAULT now()
);

-- 3. Message emoji reactions
CREATE TABLE IF NOT EXISTS group_reactions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id  uuid REFERENCES group_messages(id) ON DELETE CASCADE NOT NULL,
  user_id     text NOT NULL,
  emoji       text NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- 4. Channel members (tracks who joined + last seen)
CREATE TABLE IF NOT EXISTS group_members (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id   uuid REFERENCES group_channels(id) ON DELETE CASCADE NOT NULL,
  user_id      text NOT NULL,
  display_name text NOT NULL,
  avatar_url   text,
  joined_at    timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- ── RLS ──────────────────────────────────────
ALTER TABLE group_channels  ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members   ENABLE ROW LEVEL SECURITY;

-- Channels: anyone can read/create
CREATE POLICY "group_channels_select" ON group_channels FOR SELECT USING (true);
CREATE POLICY "group_channels_insert" ON group_channels FOR INSERT WITH CHECK (true);

-- Messages: anyone can read/insert; owner can delete
CREATE POLICY "group_messages_select" ON group_messages FOR SELECT USING (true);
CREATE POLICY "group_messages_insert" ON group_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "group_messages_delete" ON group_messages FOR DELETE USING (user_id = auth.uid()::text);

-- Reactions: anyone can read/insert; owner can delete
CREATE POLICY "group_reactions_select" ON group_reactions FOR SELECT USING (true);
CREATE POLICY "group_reactions_insert" ON group_reactions FOR INSERT WITH CHECK (true);
CREATE POLICY "group_reactions_delete" ON group_reactions FOR DELETE USING (user_id = auth.uid()::text);

-- Members: anyone can read/insert; owner can update
CREATE POLICY "group_members_select" ON group_members FOR SELECT USING (true);
CREATE POLICY "group_members_insert" ON group_members FOR INSERT WITH CHECK (true);
CREATE POLICY "group_members_update" ON group_members FOR UPDATE USING (user_id = auth.uid()::text);

-- ── Realtime ─────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE group_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE group_members;
