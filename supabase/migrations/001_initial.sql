-- Bosco MVP — Initial Schema (Multi-user)
-- See PRD.md section 8 for full documentation
-- All tables enforce Row Level Security (RLS) — each user sees only their own data.
-- IDEMPOTENT: safe to re-run (IF NOT EXISTS + DO $$ exception blocks)

-- ============================================================
-- 1. Core user tables
-- ============================================================

-- Users (extended profile linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own profile"
    ON users FOR SELECT USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own profile"
    ON users FOR INSERT WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Boats
CREATE TABLE IF NOT EXISTS boats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT,                          -- e.g. "Laurin Koster 28"
  length_m DOUBLE PRECISION,
  draft_m DOUBLE PRECISION,
  air_draft_m DOUBLE PRECISION,
  engine_type TEXT,                   -- 'Diesel', 'Gasoline', 'Electric', 'Sail-only'
  fuel_capacity_hours INTEGER,
  avg_speed_kn DOUBLE PRECISION,
  has_ais_tx BOOLEAN DEFAULT false,
  has_autopilot BOOLEAN DEFAULT false,
  has_radar BOOLEAN DEFAULT false,
  has_watermaker BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE boats ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can CRUD own boats"
    ON boats FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Navigation profiles (experience, crew mode, risk tolerance)
CREATE TABLE IF NOT EXISTS nav_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  boat_id UUID REFERENCES boats(id) ON DELETE CASCADE,
  experience TEXT CHECK (experience IN ('Beginner', 'Intermediate', 'Experienced', 'Pro')),
  crew_mode TEXT CHECK (crew_mode IN ('Solo', 'Duo', 'Family', 'Full crew')),
  risk_tolerance TEXT CHECK (risk_tolerance IN ('Cautious', 'Moderate', 'Bold')),
  night_sailing TEXT CHECK (night_sailing IN ('No', 'Yes', 'Only if necessary')),
  max_continuous_hours INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE nav_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can CRUD own nav profiles"
    ON nav_profiles FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Voyages
CREATE TABLE IF NOT EXISTS voyages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  boat_id UUID NOT NULL REFERENCES boats(id) ON DELETE CASCADE,
  nav_profile_id UUID REFERENCES nav_profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  status TEXT CHECK (status IN ('planning', 'active', 'completed')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE voyages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can CRUD own voyages"
    ON voyages FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. Voyage data tables
-- ============================================================

-- Daily briefings
CREATE TABLE IF NOT EXISTS briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  voyage_id UUID NOT NULL REFERENCES voyages(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  position TEXT NOT NULL,
  destination TEXT,
  verdict TEXT CHECK (verdict IN ('GO', 'STANDBY', 'NO-GO')),
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  wind TEXT,
  sea TEXT,
  content TEXT NOT NULL,              -- Full briefing in markdown
  weather_data JSONB,
  tide_data JSONB
);

ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can CRUD own briefings"
    ON briefings FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Logbook
CREATE TABLE IF NOT EXISTS logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  voyage_id UUID NOT NULL REFERENCES voyages(id) ON DELETE CASCADE,
  position TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  entry_type TEXT CHECK (entry_type IN ('navigation', 'arrival', 'departure', 'maintenance', 'incident')),
  fuel_tank TEXT CHECK (fuel_tank IN ('full', '3/4', 'half', '1/4', 'reserve', 'empty')),
  jerricans INTEGER DEFAULT 0,
  water TEXT CHECK (water IN ('full', '3/4', 'half', '1/4', 'reserve', 'empty')),
  problems TEXT,
  problem_tags TEXT[],
  notes TEXT,
  photo_url TEXT
);

ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can CRUD own logs"
    ON logs FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Route steps (per voyage)
CREATE TABLE IF NOT EXISTS route_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voyage_id UUID NOT NULL REFERENCES voyages(id) ON DELETE CASCADE,
  order_num INTEGER NOT NULL,
  name TEXT NOT NULL,
  from_port TEXT NOT NULL,
  to_port TEXT NOT NULL,
  distance_nm DOUBLE PRECISION,
  distance_km DOUBLE PRECISION,       -- For canals
  phase TEXT CHECK (phase IN ('Atlantic', 'Gironde', 'Garonne Canal', 'Midi Canal', 'Mediterranean')),
  status TEXT CHECK (status IN ('done', 'in_progress', 'to_do')) DEFAULT 'to_do',
  notes TEXT,
  from_lat DOUBLE PRECISION,
  from_lon DOUBLE PRECISION,
  to_lat DOUBLE PRECISION,
  to_lon DOUBLE PRECISION
);

ALTER TABLE route_steps ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can CRUD own route steps"
    ON route_steps FOR ALL
    USING (EXISTS (
      SELECT 1 FROM voyages WHERE voyages.id = route_steps.voyage_id AND voyages.user_id = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Checklist (per voyage)
CREATE TABLE IF NOT EXISTS checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voyage_id UUID NOT NULL REFERENCES voyages(id) ON DELETE CASCADE,
  task TEXT NOT NULL,
  category TEXT CHECK (category IN ('Safety', 'Propulsion', 'Navigation', 'Rigging', 'Comfort', 'Admin')),
  priority TEXT CHECK (priority IN ('Critical', 'High', 'Normal', 'Low')),
  status TEXT CHECK (status IN ('to_do', 'in_progress', 'done', 'na')) DEFAULT 'to_do',
  notes TEXT,
  completed_at TIMESTAMPTZ
);

ALTER TABLE checklist ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can CRUD own checklist"
    ON checklist FOR ALL
    USING (EXISTS (
      SELECT 1 FROM voyages WHERE voyages.id = checklist.voyage_id AND voyages.user_id = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Chat history
CREATE TABLE IF NOT EXISTS chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  voyage_id UUID NOT NULL REFERENCES voyages(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  context_snapshot JSONB               -- Position, weather, etc. at message time
);

ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can CRUD own chat history"
    ON chat_history FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Boat status (one per voyage, continuously updated)
CREATE TABLE IF NOT EXISTS boat_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voyage_id UUID NOT NULL UNIQUE REFERENCES voyages(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ DEFAULT now(),
  current_position TEXT,
  current_lat DOUBLE PRECISION,
  current_lon DOUBLE PRECISION,
  fuel_tank TEXT,
  jerricans INTEGER,
  water TEXT,
  active_problems TEXT[],
  current_phase TEXT,
  current_step_id UUID REFERENCES route_steps(id),
  nav_status TEXT CHECK (nav_status IN ('in_port', 'sailing', 'at_anchor', 'in_canal'))
);

ALTER TABLE boat_status ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can CRUD own boat status"
    ON boat_status FOR ALL
    USING (EXISTS (
      SELECT 1 FROM voyages WHERE voyages.id = boat_status.voyage_id AND voyages.user_id = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 3. Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_boats_user ON boats(user_id);
CREATE INDEX IF NOT EXISTS idx_nav_profiles_user ON nav_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_voyages_user ON voyages(user_id);
CREATE INDEX IF NOT EXISTS idx_voyages_status ON voyages(status);
CREATE INDEX IF NOT EXISTS idx_briefings_user_voyage ON briefings(user_id, voyage_id);
CREATE INDEX IF NOT EXISTS idx_briefings_date ON briefings(date DESC);
CREATE INDEX IF NOT EXISTS idx_logs_user_voyage ON logs(user_id, voyage_id);
CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_route_steps_voyage ON route_steps(voyage_id);
CREATE INDEX IF NOT EXISTS idx_route_steps_order ON route_steps(order_num);
CREATE INDEX IF NOT EXISTS idx_checklist_voyage ON checklist(voyage_id);
CREATE INDEX IF NOT EXISTS idx_checklist_status ON checklist(status);
CREATE INDEX IF NOT EXISTS idx_chat_history_user_voyage ON chat_history(user_id, voyage_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created ON chat_history(created_at DESC);

-- ============================================================
-- 4. Helper function: auto-create user profile on sign-up
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger to be idempotent
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
