# Bosco — Data Models

**Generated:** 2026-02-28 | **Scan Level:** Exhaustive

## Overview

13 tables across 6 migrations, all on Supabase PostgreSQL with Row Level Security (RLS) enabled on every table. All data is user-scoped via `user_id` or through voyage ownership.

## Entity Relationship Diagram

```
auth.users (Supabase Auth)
    │ 1:1
    ▼
  users ──────────────┬──────────────┐
    │ 1:N             │ 1:N          │ 1:N
    ▼                 ▼              ▼
  boats          nav_profiles   push_subscriptions
    │ N:1             │ N:1
    └─────┬───────────┘
          │
          ▼
       voyages ──────────────────────────────────────────────────┐
          │ 1:1          │ 1:N       │ 1:N      │ 1:N           │ 1:N
          ▼              ▼           ▼          ▼               ▼
     boat_status    route_steps   briefings    logs          checklist
          │                                                     │
          │ 1:N          │ 1:N       │ 1:N                     │
          ▼              ▼           ▼                         │
     ai_memory     chat_history  reminders                    │
          │                                                     │
          │ 1:N                                                │
          ▼                                                    │
   ai_memory_versions                                          │
```

## Tables

### Core User Tables (001_initial.sql)

#### `users`
Extended profile linked to Supabase Auth.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, FK → auth.users(id) | Same as Supabase Auth UID |
| `email` | TEXT | NOT NULL, UNIQUE | |
| `name` | TEXT | | Display name |
| `onboarding_completed` | BOOLEAN | DEFAULT false | Controls redirect to /onboarding |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

**RLS:** SELECT, UPDATE, INSERT — `auth.uid() = id`
**Auto-creation:** Trigger `on_auth_user_created` inserts a row when a new auth user signs up.

#### `boats`
Boat specifications per user.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `user_id` | UUID | NOT NULL, FK → users(id) CASCADE | |
| `name` | TEXT | NOT NULL | e.g. "Laurine" |
| `type` | TEXT | | e.g. "Laurin Koster 28" |
| `length_m` | DOUBLE PRECISION | | Length in meters |
| `draft_m` | DOUBLE PRECISION | | Draft in meters |
| `air_draft_m` | DOUBLE PRECISION | | Air draft in meters |
| `engine_type` | TEXT | | Diesel, Gasoline, Electric, Sail-only |
| `fuel_capacity_hours` | INTEGER | | Total fuel autonomy |
| `avg_speed_kn` | DOUBLE PRECISION | | Average speed in knots |
| `has_ais_tx` | BOOLEAN | DEFAULT false | AIS transmitter |
| `has_autopilot` | BOOLEAN | DEFAULT false | |
| `has_radar` | BOOLEAN | DEFAULT false | |
| `has_watermaker` | BOOLEAN | DEFAULT false | Desalinator |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

**RLS:** ALL — `auth.uid() = user_id`

#### `nav_profiles`
Navigator experience and preferences.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `user_id` | UUID | NOT NULL, FK → users(id) CASCADE | |
| `boat_id` | UUID | FK → boats(id) CASCADE | |
| `experience` | TEXT | CHECK IN (Beginner, Intermediate, Experienced, Pro) | |
| `crew_mode` | TEXT | CHECK IN (Solo, Duo, Family, Full crew) | |
| `risk_tolerance` | TEXT | CHECK IN (Cautious, Moderate, Bold) | |
| `night_sailing` | TEXT | CHECK IN (No, Yes, Only if necessary) | |
| `max_continuous_hours` | INTEGER | | Max hours sailing without break |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

**RLS:** ALL — `auth.uid() = user_id`

#### `voyages`
Voyages per user, linking boat and profile.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `user_id` | UUID | NOT NULL, FK → users(id) CASCADE | |
| `boat_id` | UUID | NOT NULL, FK → boats(id) CASCADE | |
| `nav_profile_id` | UUID | FK → nav_profiles(id) SET NULL | |
| `name` | TEXT | NOT NULL | e.g. "Audierne → Nice" |
| `status` | TEXT | CHECK IN (planning, active, completed), DEFAULT 'active' | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

**RLS:** ALL — `auth.uid() = user_id`

### Voyage Data Tables (001_initial.sql)

#### `boat_status`
Continuously updated current state (one per voyage).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `voyage_id` | UUID | NOT NULL, UNIQUE, FK → voyages(id) CASCADE | 1:1 with voyage |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |
| `current_position` | TEXT | | Port name or description |
| `current_lat` | DOUBLE PRECISION | | |
| `current_lon` | DOUBLE PRECISION | | |
| `fuel_tank` | TEXT | | full, 3/4, half, 1/4, reserve, empty |
| `jerricans` | INTEGER | | Number of jerry cans |
| `water` | TEXT | | Same enum as fuel_tank |
| `active_problems` | TEXT[] | | Array of problem descriptions |
| `current_phase` | TEXT | | Atlantic, Gironde, etc. |
| `current_step_id` | UUID | FK → route_steps(id) | Points to current route leg |
| `nav_status` | TEXT | CHECK IN (in_port, sailing, at_anchor, in_canal) | |

**RLS:** ALL via voyage ownership subquery

#### `briefings`
Daily AI-generated briefings.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `user_id` | UUID | NOT NULL, FK → users(id) CASCADE | |
| `voyage_id` | UUID | NOT NULL, FK → voyages(id) CASCADE | |
| `date` | DATE | NOT NULL | Briefing date |
| `position` | TEXT | NOT NULL | Position at generation time |
| `destination` | TEXT | | Current step destination |
| `verdict` | TEXT | CHECK IN (GO, STANDBY, NO-GO) | Parsed from AI response |
| `confidence` | TEXT | CHECK IN (high, medium, low) | |
| `wind` | TEXT | | Wind summary (parsed) |
| `sea` | TEXT | | Sea state summary (parsed) |
| `content` | TEXT | NOT NULL | Full markdown briefing |
| `weather_data` | JSONB | | Raw weather snapshot |
| `tide_data` | JSONB | | Raw tide snapshot |

**RLS:** ALL — `auth.uid() = user_id`

#### `logs`
Logbook entries.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `user_id` | UUID | NOT NULL, FK → users(id) CASCADE | |
| `voyage_id` | UUID | NOT NULL, FK → voyages(id) CASCADE | |
| `position` | TEXT | NOT NULL | |
| `latitude` | DOUBLE PRECISION | | |
| `longitude` | DOUBLE PRECISION | | |
| `entry_type` | TEXT | CHECK IN (navigation, arrival, departure, maintenance, incident) | |
| `fuel_tank` | TEXT | CHECK IN (full, 3/4, half, 1/4, reserve, empty) | |
| `jerricans` | INTEGER | DEFAULT 0 | |
| `water` | TEXT | CHECK IN (full, 3/4, half, 1/4, reserve, empty) | |
| `problems` | TEXT | | Free text |
| `problem_tags` | TEXT[] | | Categorized tags |
| `notes` | TEXT | | |
| `photo_urls` | TEXT[] | | Multiple photos (migrated from photo_url) |

**RLS:** ALL — `auth.uid() = user_id`

#### `route_steps`
Route legs per voyage.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `voyage_id` | UUID | NOT NULL, FK → voyages(id) CASCADE | |
| `order_num` | INTEGER | NOT NULL | Sequence number |
| `name` | TEXT | NOT NULL | e.g. "Audierne → Lorient" |
| `from_port` | TEXT | NOT NULL | |
| `to_port` | TEXT | NOT NULL | |
| `distance_nm` | DOUBLE PRECISION | | Nautical miles (maritime) |
| `distance_km` | DOUBLE PRECISION | | Kilometers (canals) |
| `phase` | TEXT | CHECK IN (Atlantic, Gironde, Garonne Canal, Midi Canal, Mediterranean) | |
| `status` | TEXT | CHECK IN (done, in_progress, to_do), DEFAULT 'to_do' | |
| `notes` | TEXT | | |
| `from_lat` | DOUBLE PRECISION | | |
| `from_lon` | DOUBLE PRECISION | | |
| `to_lat` | DOUBLE PRECISION | | |
| `to_lon` | DOUBLE PRECISION | | |

**RLS:** ALL via voyage ownership subquery

#### `checklist`
Task management per voyage.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `voyage_id` | UUID | NOT NULL, FK → voyages(id) CASCADE | |
| `task` | TEXT | NOT NULL | |
| `category` | TEXT | CHECK IN (Safety, Propulsion, Navigation, Rigging, Comfort, Admin) | |
| `priority` | TEXT | CHECK IN (Critical, High, Normal, Low) | |
| `status` | TEXT | CHECK IN (to_do, in_progress, done, na), DEFAULT 'to_do' | |
| `notes` | TEXT | | |
| `completed_at` | TIMESTAMPTZ | | |

**RLS:** ALL via voyage ownership subquery

#### `chat_history`
AI chat messages with context snapshots.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `user_id` | UUID | NOT NULL, FK → users(id) CASCADE | |
| `voyage_id` | UUID | NOT NULL, FK → voyages(id) CASCADE | |
| `role` | TEXT | CHECK IN (user, assistant) | |
| `content` | TEXT | NOT NULL | Text or JSON (if tool_calls) |
| `context_snapshot` | JSONB | | Position, weather status, date |

**RLS:** ALL — `auth.uid() = user_id`

### Reminders (002_reminders.sql)

#### `reminders`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `user_id` | UUID | NOT NULL, FK → users(id) CASCADE | |
| `voyage_id` | UUID | NOT NULL, FK → voyages(id) CASCADE | |
| `message` | TEXT | NOT NULL | |
| `remind_at` | TIMESTAMPTZ | NOT NULL | Scheduled time |
| `category` | TEXT | CHECK IN (navigation, safety, maintenance, provisions, general) | |
| `priority` | TEXT | CHECK IN (high, medium, low), DEFAULT 'medium' | |
| `status` | TEXT | CHECK IN (pending, fired, dismissed), DEFAULT 'pending' | |
| `fired_at` | TIMESTAMPTZ | | When the trigger engine fired it |
| `created_by` | TEXT | DEFAULT 'user' | 'user' or 'ai' |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

### Push Subscriptions (003_push_subscriptions.sql)

#### `push_subscriptions`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `user_id` | UUID | NOT NULL, FK → users(id) CASCADE | |
| `endpoint` | TEXT | NOT NULL, UNIQUE | Push service endpoint |
| `keys_p256dh` | TEXT | NOT NULL | Encryption key |
| `keys_auth` | TEXT | NOT NULL | Auth key |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

### AI Memory (006_ai_memory.sql)

#### `ai_memory`
Persistent AI memory documents (4 per voyage).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `user_id` | UUID | NOT NULL, FK → auth.users(id) CASCADE | |
| `voyage_id` | UUID | NOT NULL, FK → voyages(id) CASCADE | |
| `slug` | TEXT | NOT NULL, CHECK IN (situation, boat, crew, preferences) | |
| `content` | TEXT | NOT NULL, DEFAULT '' | Markdown content |
| `version` | INT | NOT NULL, DEFAULT 1 | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| `updated_by` | TEXT | NOT NULL, DEFAULT 'system', CHECK IN (chat, cron, system) | |

**Unique:** `(voyage_id, slug)`

#### `ai_memory_versions`
Version history for AI memory (keeps last 5).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `memory_id` | UUID | NOT NULL, FK → ai_memory(id) CASCADE | |
| `content` | TEXT | NOT NULL | |
| `version` | INT | NOT NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| `updated_by` | TEXT | NOT NULL, DEFAULT 'system' | |

## Indexes

| Index | Table | Columns | Notes |
|-------|-------|---------|-------|
| `idx_boats_user` | boats | user_id | |
| `idx_nav_profiles_user` | nav_profiles | user_id | |
| `idx_voyages_user` | voyages | user_id | |
| `idx_voyages_status` | voyages | status | For cron: find active voyages |
| `idx_briefings_user_voyage` | briefings | user_id, voyage_id | Composite |
| `idx_briefings_date` | briefings | date DESC | Latest first |
| `idx_logs_user_voyage` | logs | user_id, voyage_id | Composite |
| `idx_logs_created` | logs | created_at DESC | Latest first |
| `idx_route_steps_voyage` | route_steps | voyage_id | |
| `idx_route_steps_order` | route_steps | order_num | Ordered traversal |
| `idx_checklist_voyage` | checklist | voyage_id | |
| `idx_checklist_status` | checklist | status | Filter pending |
| `idx_chat_history_user_voyage` | chat_history | user_id, voyage_id | Composite |
| `idx_chat_history_created` | chat_history | created_at DESC | Latest first |
| `idx_ai_memory_voyage` | ai_memory | voyage_id | |
| `idx_ai_memory_user` | ai_memory | user_id | |
| `idx_ai_memory_versions_memory` | ai_memory_versions | memory_id, version DESC | Version lookup |

## RLS Policy Patterns

Two patterns used:

**Direct ownership:**
```sql
USING (auth.uid() = user_id)
```
Used by: users, boats, nav_profiles, voyages, briefings, logs, chat_history, ai_memory

**Indirect ownership via voyage:**
```sql
USING (EXISTS (
  SELECT 1 FROM voyages
  WHERE voyages.id = table.voyage_id
  AND voyages.user_id = auth.uid()
))
```
Used by: boat_status, route_steps, checklist, ai_memory_versions

## Migration History

| # | File | Tables Added | Key Changes |
|---|------|-------------|-------------|
| 001 | `001_initial.sql` | users, boats, nav_profiles, voyages, boat_status, briefings, logs, route_steps, checklist, chat_history | Core schema, 14 indexes, RLS, auto-user trigger |
| 002 | `002_reminders.sql` | reminders | Reminder system with categories + status |
| 003 | `003_push_subscriptions.sql` | push_subscriptions | Web Push VAPID storage |
| 004 | `004_photo_urls.sql` | — | `photo_url TEXT` → `photo_urls TEXT[]` on logs |
| 005 | `005_relax_phase_check.sql` | — | Removed hardcoded phase CHECK constraint on route_steps |
| 006 | `006_ai_memory.sql` | ai_memory, ai_memory_versions | Persistent AI memory with versioning |

## Auto-Migration System

Migrations run automatically at server startup via `src/instrumentation.ts` → `src/lib/db/migrate.ts`. The runner:
1. Reads all `.sql` files from `supabase/migrations/`
2. Tracks applied migrations in a `_migrations` tracking mechanism
3. Executes unapplied migrations in order
4. All migrations are idempotent (`IF NOT EXISTS`, `DO $$ EXCEPTION` blocks)
