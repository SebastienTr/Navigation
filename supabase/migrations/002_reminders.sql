-- ── Table reminders ───────────────────────────────────────────────────────
-- Rappels programmés par l'IA ou par l'utilisateur.
-- Évalués par le cron triggers toutes les 4h.
-- IDEMPOTENT: safe to re-run (IF NOT EXISTS + DO $$ exception blocks)

CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  voyage_id UUID NOT NULL REFERENCES voyages(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  remind_at TIMESTAMPTZ NOT NULL,
  category TEXT CHECK (category IN ('navigation','safety','maintenance','provisions','general')) DEFAULT 'general',
  priority TEXT CHECK (priority IN ('high','medium','low')) DEFAULT 'medium',
  status TEXT CHECK (status IN ('pending','fired','dismissed')) DEFAULT 'pending',
  fired_at TIMESTAMPTZ,
  created_by TEXT CHECK (created_by IN ('ai','user')) DEFAULT 'ai'
);

-- Index pour le cron : trouver les reminders à déclencher
CREATE INDEX IF NOT EXISTS idx_reminders_pending ON reminders (remind_at)
  WHERE status = 'pending';

-- Index pour les requêtes par voyage
CREATE INDEX IF NOT EXISTS idx_reminders_voyage ON reminders (voyage_id, status);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view their own reminders"
    ON reminders FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert their own reminders"
    ON reminders FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own reminders"
    ON reminders FOR UPDATE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete their own reminders"
    ON reminders FOR DELETE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
