-- ─────────────────────────────────────────────────────────────────────
-- TalkBack — Supabase setup
-- Run this in the SQL Editor at: https://supabase.com/dashboard
-- ─────────────────────────────────────────────────────────────────────

-- 1. Create the sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id            BIGSERIAL PRIMARY KEY,
  session_id    TEXT UNIQUE NOT NULL,
  variant       TEXT,
  action        TEXT DEFAULT 'register',
  first_name    TEXT,
  email         TEXT,
  device        TEXT,
  browser       TEXT,
  page_url      TEXT,
  conversation_id TEXT,
  duration_s    INTEGER,
  transcript    TEXT,
  edited        BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- 2. Index for fast dashboard queries
CREATE INDEX IF NOT EXISTS idx_sessions_variant    ON sessions (variant);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_action     ON sessions (action);

-- 3. Enable Row Level Security (required by Supabase)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies — allow the anon/publishable key to read and write
--    (this is safe because the publishable key is already in the client-side code)
CREATE POLICY "Allow anon insert" ON sessions
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon select" ON sessions
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "Allow anon update" ON sessions
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);
