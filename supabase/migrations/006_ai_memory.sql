-- 006_ai_memory.sql
-- Persistent AI memory documents for Bosco
-- Memory docs are read by chat, briefing, and trigger prompts
-- Written by chat tool (real-time) and extraction cron (batch every 12h)

-- ── ai_memory: the current state of each memory document ──────────────────
CREATE TABLE IF NOT EXISTS ai_memory (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voyage_id   UUID NOT NULL REFERENCES voyages(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL CHECK (slug IN ('situation', 'boat', 'crew', 'preferences')),
  content     TEXT NOT NULL DEFAULT '',
  version     INT NOT NULL DEFAULT 1,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  TEXT NOT NULL DEFAULT 'system' CHECK (updated_by IN ('chat', 'cron', 'system')),

  UNIQUE (voyage_id, slug)
);

CREATE INDEX idx_ai_memory_voyage ON ai_memory(voyage_id);
CREATE INDEX idx_ai_memory_user   ON ai_memory(user_id);

-- ── ai_memory_versions: keep last N versions for rollback ─────────────────
CREATE TABLE IF NOT EXISTS ai_memory_versions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id   UUID NOT NULL REFERENCES ai_memory(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  version     INT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  TEXT NOT NULL DEFAULT 'system'
);

CREATE INDEX idx_ai_memory_versions_memory ON ai_memory_versions(memory_id, version DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE ai_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_memory_versions ENABLE ROW LEVEL SECURITY;

-- Users can read their own memory docs
CREATE POLICY "Users can read own memory"
  ON ai_memory FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own memory docs
CREATE POLICY "Users can insert own memory"
  ON ai_memory FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own memory docs
CREATE POLICY "Users can update own memory"
  ON ai_memory FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can read their own memory versions
CREATE POLICY "Users can read own memory versions"
  ON ai_memory_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ai_memory
      WHERE ai_memory.id = ai_memory_versions.memory_id
        AND ai_memory.user_id = auth.uid()
    )
  );

-- Service role (admin client) bypasses RLS for cron jobs
