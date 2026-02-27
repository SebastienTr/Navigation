# Laurine Navigator — Product Requirements Document (MVP)

**Version** : 1.2
**Date** : February 27, 2026
**Author** : Sébastien Treille (skipper) + Claude (AI copilot)
**Status** : Draft

> **This document is the MVP PRD** — Multi-user app with beta access for Sébastien and sailing friends.
> The long-term product vision (freemium, BYOAI option, multi-provider) is in **[VISION.md](./VISION.md)** ("Skipper AI").
> The MVP supports multi-user from day 1, with extensible architecture for upcoming features.

---

## 1. Vision

### The problem

Traditional navigation tools (Navionics, marine weather, VHF, paper logbooks) operate in silos. A solo navigator must juggle between 5 to 10 sources to make a single decision: "Should I leave today?". For solo sailing, this cognitive load is a risk factor.

Centralization attempts via Notion or generic apps hit three limits: no integrated map, no contextual intelligence, no adaptation to the skipper's and boat's profile.

### The solution

**Laurine Navigator** is an **AI first mate** — not just a navigation tool, but a proactive copilot that monitors, anticipates, and speaks to the captain when relevant. It centralizes weather, tides, currents, map, logbook, checklist, and route tracking in a single mobile-optimized interface. The AI produces an operational verdict each morning (GO / STANDBY / NO-GO) with an executable plan, but also intervenes during the day if the situation changes. The skipper can query his mate at any time via contextual chat.

> **Server-side AI (MVP)** : Laurine Navigator uses a shared Claude API key (server-side). Each skipper brings their own boat, profile, and voyage. Free during beta.
>
> **Note V1 → V1.5** : In V1.5, we plan to offer BYOAI as an option (bring your own API key) and freemium tiers. The MVP architecture supports this path. See [VISION.md](./VISION.md).

### Why now

Sébastien is conveying his Laurin Koster 28 "Laurine" from Gothenburg (Sweden) to Nice. The boat is currently wintered in Audierne (Finistère). Navigation resumption is planned for mid-March 2026. The remaining itinerary — Atlantic, Gironde, Midi canals, Mediterranean — includes critical passages (Raz de Sein, Gironde, Gulf of Lion) that justify a robust decision-support tool.

---

## 2. Target user

### Primary: Sébastien

| Attribute | Value |
|---|---|
| Experience | Experienced — Gothenburg → Audierne largely solo |
| Navigation mode | Solo, ready for 24h passages if conditions OK |
| Risk tolerance | Reasonable — wants to advance but not at the cost of safety |
| Electronic equipment | Simrad plotter + Android phone + tablet, Navionics x3 |
| Connectivity at sea | Intermittent coastal 4G, sometimes nothing |
| Reading context | Phone, one hand, cockpit, potentially tired |
| Expectation toward AI | Talk "skipper to skipper", zero beginner pedagogy, frank recommendations |

### Secondary: Beta testers (Sébastien's sailing friends)

- Independent skippers with their own boats, ranging from coastal day sailors to long-distance cruisers
- Access via magic link email authentication during beta
- Each has personalized boat specs, profile (experience, risk tolerance), and voyage configuration

### Jobs-to-be-done

1. **Decide if I'm leaving** — Each morning, in 10 seconds, know if it's GO or not.
2. **Plan my route** — If GO, have an executable plan (departure time, waypoints, fallback, ETA).
3. **Monitor during sailing** — Weather changing, currents, fatigue, fuel.
4. **Log my voyage** — Position, fuel, water, problems, notes — quickly from the phone.
5. **Solve real-time questions** — "Can I shift my departure to 2pm?", "What fallback port if it degrades?".
6. **Track my progress** — Where I am on Audierne → Nice, how much is left.
7. **Prepare my boat** — Structured post-winter checklist.

---

## 3. The boat

Each skipper configures their boat during onboarding.

**Example: Laurine (Sébastien's boat)**

| Spec | Value |
|---|---|
| Type | Laurin Koster 28 (Swedish sailing boat, solid construction) |
| Length | ~8.5m |
| Draft | ~1.45m |
| Air draft | ~12m (critical for canal bridges) |
| Engine | Diesel |
| Fuel | ~20h engine in tank + ~20h in jerricans |
| Average speed | ~4.5 kn (for ETA calculations) |
| AIS | No transmitter (receiver only) |
| Autopilot | Uncertain reliability |
| Navigation lights | Broken — repair planned before departure |
| Electronics | Simrad plotter, Navionics (3 devices) |

---

## 4. Itinerary: Audierne → Nice

### Navigation phases

| Phase | Segment | Characteristics | Main risks |
|---|---|---|---|
| **Atlantic** | Audierne → Royan | Coastal cabotage, tides, currents | Raz de Sein, westerly swell, Ouessant DST |
| **Gironde** | Royan → Bordeaux | Estuary, strong currents | Commercial traffic, tidal currents, sandbanks |
| **Garonne Canal** | Bordeaux → Toulouse | Lateral canal, locks | VNF lock schedules, limited speed 8 km/h |
| **Midi Canal** | Toulouse → Sète | Canal, locks, low bridges | Bridge air draft, Saint-Roch lock (work?), water levels (drought) |
| **Mediterranean** | Sète → Nice | Coastal cabotage | Mistral, Tramontane, Gulf of Lion, local accelerations |

### Planned legs (20)

1. Audierne → Bénodet (Raz de Sein) — 30 NM
2. Bénodet → Lorient — 35 NM
3. Lorient → Belle-Île — 25 NM
4. Belle-Île → Le Croisic — 30 NM
5. Le Croisic → Pornic — 25 NM
6. Pornic → Les Sables-d'Olonne — 40 NM
7. Les Sables → La Rochelle — 45 NM
8. La Rochelle → Royan — 35 NM
9. Royan → Bordeaux (Gironde) — 55 NM
10. Bordeaux → Agen (canal) — ~100 km
11. Agen → Toulouse (canal) — ~100 km
12. Toulouse → Castelnaudary (canal) — ~60 km
13. Castelnaudary → Carcassonne (canal) — ~40 km
14. Carcassonne → Béziers (canal) — ~80 km
15. Béziers → Sète (canal + Thau lagoon) — ~40 km
16. Sète → Port-Camargue — 30 NM
17. Port-Camargue → Marseille — 55 NM
18. Marseille → Toulon — 35 NM
19. Toulon → Hyères — 20 NM
20. Hyères → Nice — 60 NM

**Total maritime distance** : ~520 NM
**Canal distance** : ~420 km

---

## 5. Technical stack

### Architecture

```
┌─────────────────────────────────────────┐
│           FRONTEND (PWA)                │
│  Next.js + React + Tailwind + Leaflet   │
│  Deployed on Vercel                     │
│  Installable on Android (Add to Home)   │
│  Service Worker for offline cache       │
│  Push Notifications (Web Push API)      │
├─────────────────────────────────────────┤
│              API ROUTES                 │
│  /api/ai/proxy    → Claude API (server) │
│  /api/ai/triggers → Eval triggers (cron)│
│  /api/ai/route    → AI route proposals  │
│  /api/briefing    → Generate briefing   │
│  /api/chat        → Copilot chat        │
│  /api/weather     → Weather proxy       │
│  /api/tides       → Tides proxy         │
├─────────────────────────────────────────┤
│            SUPABASE (BDD)               │
│  users, boats, nav_profiles, voyages,   │
│  briefings, logs, route, checklist,     │
│  chat_history, boat_status              │
│  Supabase Auth (magic link email)       │
│  Row Level Security (RLS per user)      │
│  Realtime subscriptions                 │
├─────────────────────────────────────────┤
│          EXTERNAL SERVICES              │
│  Open-Meteo (marine weather, free)      │
│  WorldTides (~2€/month, tides)          │
│  Claude API (server-side key)           │
│  OpenStreetMap / Leaflet (map)          │
│  Vercel Cron (briefing 5am + triggers 4am)│
│  Web Push (proactive notifications)     │
└─────────────────────────────────────────┘
```

### Justifications

| Choice | Why |
|---|---|
| **Next.js + Vercel** | Vercel already connected, trivial deployment, integrated API routes, edge functions for perf |
| **PWA** | No need to publish to Play Store, installable in 1 click, offline cache, works like a native app |
| **Supabase + Auth** | Free tier 500MB (plenty), PostgreSQL, integrated magic link auth, realtime, RLS policies |
| **Leaflet + OSM** | Free, lightweight, works offline with cached tiles, no Google/Mapbox dependency |
| **Open-Meteo** | Free, no API key required, marine data (wind, swell, period) |
| **Claude API (server-side)** | Shared server key during beta. Most capable for complex reasoning (nav decisions), long context. Free for users during beta, Sébastien covers cost. BYOAI option planned for V1.5 |

### Estimated costs

| Service | Cost |
|---|---|
| Vercel (Hobby) | Free |
| Supabase (Free) | Free |
| Open-Meteo | Free |
| WorldTides | ~2€/month |
| Claude API (server-side, Haiku chat, Sonnet briefings) | ~5-15€/month during beta (paid by Sébastien for all users) |
| **Total** | **~7-17€/month** |

---

## 6. Features

### 6.0 Onboarding wizard

Shown only on first login (when `user.onboarding_completed = false`). Structured 4-step flow.

#### Step 1 — My boat
Configure your vessel specifications:
- Boat name (e.g. "Laurine", "Blue Moon")
- Boat type (e.g. "Laurin Koster 28", "Catamaran", "Monohull")
- Length (meters)
- Draft (meters)
- Air draft (meters, critical for bridges)
- Engine type (Diesel / Gasoline / Electric / Sail-only)
- Fuel capacity (in operating hours, e.g. 40h)
- Average cruising speed (knots)
- Equipment checkboxes: AIS transmitter, autopilot, radar, watermaker

#### Step 2 — My profile
Personalize AI decision thresholds:
- Experience level (Beginner / Intermediate / Experienced / Pro)
- Crew mode (Solo / Duo / Family / Full crew)
- Risk tolerance (Cautious / Moderate / Bold)
- Night sailing preference (No / Yes / Only if necessary)
- Max continuous sailing hours (e.g. 12h)

#### Step 3 — My voyage
Define your route via an AI-assisted conversational flow:

**3a. Input** — Voyage name + departure/arrival ports:
- Voyage name (e.g. "Audierne → Nice", "Göteborg → Audierne")
- From: departure port (text, with autocomplete)
- To: arrival port (text, with autocomplete)

**3b. AI route proposals** — Claude analyzes departure/arrival, boat specs (draft, air draft, fuel capacity), and navigator profile to propose **2-3 route options**. Each option includes:
- Route name and summary (e.g. "Via canals", "Via Gibraltar", "Offshore direct")
- Estimated total distance (NM + km for canal sections)
- Estimated duration (days, accounting for locks, weather windows, etc.)
- Key waypoints / intermediate ports
- Pros and cons (safety, speed, cost, scenery, difficulty)
- Warnings based on boat specs (e.g. "Air draft 12m — tight under some Midi Canal bridges")

Example for "Audierne → Nice":
- **Option A — Atlantic + Canals**: Coast to Royan → Gironde → Canal de Garonne → Canal du Midi → Sète → Med coast. ~520 NM + ~420 km canals. Safest, no open sea crossings, but slow (locks, VNF schedules).
- **Option B — Via Gibraltar**: Atlantic coast → Bay of Biscay → Spain → Gibraltar → Med. ~1800 NM. All maritime, faster with good weather, but exposed passages (Biscay, Finisterre).

Example for "Göteborg → Audierne":
- **Option A — North Sea + Channel**: Skagerrak → North Sea → English Channel → Atlantic. ~900 NM.
- **Option B — Kiel Canal + Channel**: Kiel Canal → North Sea → Channel. Shorter, avoids Skagerrak.

**3c. Selection + customization**:
- User selects one option, OR chooses **"Other"** and describes their preferred route in free text (e.g. "I want to go via Kiel but stop in the Netherlands and cross to England first")
- If "Other": Claude generates a custom route from the text description
- After selection, Claude generates detailed `route_steps` (all legs with ports, distances, coordinates, notes, dangers)
- Interactive map preview shows the full route with waypoints
- User can manually adjust: add/remove/reorder stops, drag waypoints on map

**3d. Confirm or skip**:
- **Confirm**: Route steps saved to `route_steps`, boat_status initialized at departure port
- **Skip for now**: Create voyage without route, add later from Settings or Route page

#### Step 4 — Done
- Summary confirmation
- Dashboard appears
- Set `user.onboarding_completed = true`

---

### 6.1 Dashboard (main screen)

The screen Sébastien sees when opening the app. Must be readable in 10 seconds.

**Content:**
- Today's verdict: GO ✅ / STANDBY ⏳ / NO-GO ❌ (big, colored, impossible to miss)
- Confidence level: high / medium / low
- Mini-map with current position and destination
- Condensed weather: wind, sea, visibility
- Levels: fuel, water (visual bars)
- Route progress: stage X/20, remaining NM
- Direct link to full briefing

**Interactions:**
- Tap on verdict → full briefing
- Tap on map → full-screen map view
- Tap on levels → quick update form
- Pull-to-refresh → refresh weather

### 6.2 Map

Interactive map centered on current position with navigation context.

**Content:**
- Current position (boat marker)
- Complete route Audierne → Nice (polyline)
- Past stages (grayed) / current (colored) / upcoming (dashed)
- Fallback ports suggested by briefing (orange markers)
- Danger zones (Raz de Sein, DST, Gulf of Lion — red semi-transparent polygons)
- Day's nav waypoints
- Nautical tiles if available (OpenSeaMap overlay)

**Interactions:**
- Tap on a port → info (VHF, harbormaster, fuel, shelter)
- Tap on a danger zone → explanation (currents, constraints)
- Tap on a stage → details (distance, estimated duration, notes)
- "Center on me" button (phone GPS)

**Offline:**
- Tile cache for current zone + 100 NM around
- Route and waypoints stored locally

### 6.3 Daily briefing

The complete briefing generated each morning at 5am by AI.

**Format:** Identical to format defined in scheduled task prompt (see section 7).

**Features:**
- Today's briefing displayed at top
- Scrollable history of previous briefings
- Filter by verdict (GO / STANDBY / NO-GO)
- Each briefing stored with metadata (position, destination, wind, sea, verdict)

### 6.4 Logbook

Quick entry from phone, optimized for one-handed cockpit use.

**Fields:**
- Date/time (auto-filled)
- Position (auto-detected by GPS, editable)
- Fuel tank level (slider or quick selector: full / 3/4 / half / 1/4 / reserve)
- Jerricans remaining (counter)
- Fresh water (slider)
- Entry type: navigation / arrival / departure / maintenance / incident
- Problems (free text + tags: engine, rigging, electrical, sail, hull)
- Notes (free text)
- Photo (optional, from camera)

**UX:**
- Single-page form, no infinite scroll
- Large, tap-friendly buttons
- Smart pre-fill (last position, last levels)
- Local save if no connection → sync when network available

### 6.5 AI Chat (copilot)

Conversational chat with AI copilot, contextualized with all voyage data.

**Automatically injected context:**
- Current position (from last log)
- Current weather and forecasts
- Latest briefing
- Fuel/water levels
- Current problems
- Next route stage
- Boat specifications
- Decision profile (GO/STANDBY/NO-GO thresholds)
- Voyage history

**Example questions:**
- "Can I leave at 2pm instead of 8am?"
- "What's the best fallback port if wind reaches F7?"
- "Remind me of the Raz de Sein constraints"
- "I have an engine overheating problem, what do I check?"
- "How many days to reach Bordeaux at current pace?"
- "Summarize the VNF situation for the Midi Canal"

**AI Model:**
- Claude Haiku for quick questions (low latency, low cost)
- Claude Sonnet for complex analysis (routing, critical decisions)
- Automatic selection based on detected question complexity

**UX:**
- Standard chat interface (bubbles, input at bottom)
- Suggestion buttons ("Today's Briefing", "Fuel Status", "Next Stage")
- Persistent conversation history
- Works even in degraded mode (response based on cached data if no API connection)

### 6.7 Checklist

Task lists organized by category and priority.

**Categories:**
- Safety (red)
- Propulsion (orange)
- Navigation (blue)
- Rigging (yellow)
- Comfort (green)
- Admin (gray)

**Priorities:**
- Critical
- High
- Normal
- Low

**Features:**
- Check/uncheck from phone
- Filter by category or priority
- Progress counter (X/Y done)
- Pre-filled with post-winter checklist
- Add new tasks (AI briefing can suggest them)
- Notes per task

### 6.8 Route

View of overall voyage progress.

**Content:**
- List of 20 stages with visual status: ✅ done / 🔵 in progress / ⬜ to do
- Overall progress bar
- For each stage: from → to, distance, estimated duration, notes, dangers
- Current phase (Atlantic / Gironde / Garonne Canal / Midi Canal / Mediterranean)
- Global estimated ETA (based on average pace + typical weather windows)
- Stats: NM traveled, sailing days, waiting days

### 6.9 Settings

Account and vessel management.

**Profile editing:**
- Edit boat specs (name, type, length, draft, air draft, engine, fuel capacity, average speed, equipment)
- Edit nav profile (experience, crew mode, risk tolerance, night sailing, max hours)

**Voyage management:**
- List all voyages (active, planning, completed)
- Edit voyage name and route (same AI route proposal flow as onboarding step 3)
- Create new voyage (triggers route wizard)
- Switch active voyage
- Add/remove/reorder route steps manually

**Account:**
- Email (from Supabase Auth)
- Logout
- Account deletion (optional, for privacy)

**No API key management in MVP** — Claude API is server-side.

---

## 7. AI System — The first mate

### 7.1 Server-side AI (MVP)

The Claude API key is a server environment variable (`ANTHROPIC_API_KEY`). Every LLM call goes through a proxy:

```
Captain → /api/ai/proxy → {system_prompt + context + message} → Claude API (server key) → response
```

The proxy reads the server API key, builds the complete system prompt with the user's boat specs, profile, position, weather, levels, current problems, next stage, and voyage history. **The complexity is in the prompt, not in the code.** All users share the same API key during MVP (free beta). BYOAI (bring your own key) is a V1.5 feature.

### 7.2 Daily briefing (temporal trigger)

**Trigger:** Vercel Cron Job at 5:00am (French time) every day.

**Process:**
1. Read current position from Supabase (last log)
2. Read fuel/water/problem levels
3. Identify next route stage
4. Call Open-Meteo for marine weather (wind, swell, visibility)
5. Call WorldTides for tides and currents
6. Check VNF notices if in canal phase
7. Build prompt with all context
8. Call Claude Sonnet via AI proxy
9. Parse and store in Supabase (briefings table)
10. Push notification → "Your briefing is ready"

**Decision profile (integrated into prompt):**
- **GO** : gusts/sea/current consistent + at least 1 realistic fallback + acceptable solo risk
- **STANDBY** : window <72h but model uncertainty, or borderline conditions
- **NO-GO** : strong cross seas, violent front, degraded Raz/Gulf of Lion, visibility <1NM, unmanageable traffic without AIS transmitter

**Model divergence rule:**
If Open-Meteo (GFS) vs Météo France diverge → STANDBY by default unless ultra-clean window.

### 7.3 Proactive triggers (MVP)

In addition to morning briefing, the mate monitors and intervenes when relevant. For MVP, these triggers are implemented (most useful, simplest):

| Trigger | Condition | Action |
|---|---|---|
| **Weather changes** | Predicted wind changes > 10 kn vs morning briefing | Notification + change summary + fallback port |
| **Log reminder** | No log in 12h | "Hey, all good? A quick log?" |
| **Departure watch** | Tomorrow = GO (favorable D-1 briefing) | "Tomorrow is GO. Pre-departure checklist: [5 items]" |
| **Critical checklist** | Critical item unchecked + departure < 3 days | "Lights still broken, departure in 3 days" |
| **Low fuel** | Fuel < 25% (from last log) | "~Xh engine remaining. Next fuel: [port]" |

**Implementation:** Single additional Vercel Cron Job (every 4h, 6am to 10pm) that evaluates the 5 rules above. If condition true → LLM call to generate contextualized message → push notification. Simple, cheap (~5 AI calls/day max).

> Advanced triggers (zone change, provisions, fatigue, multi-day planning) are in [VISION.md](./VISION.md) for V1.5/V2.

### 7.4 Contextual chat (talk to the mate)

**Architecture:**
- Next.js API Route `/api/chat` → AI proxy
- Receives user message + user_id + voyage_id
- Builds system context from Supabase (position, weather, briefing, logs, problems, route, trigger history — filtered by voyage)
- Calls Claude via AI proxy (server-side key)
- Streams response
- Stores exchange in `chat_history` with user_id and voyage_id

**Chat is natural** — the captain talks to his mate like to a human: "Where are we?", "What's the plan?", "I'm hesitant to leave". The mate has all the context.

**Chat system prompt:**
Identical to briefing prompt (skipper context, voyage, decision profile) + live data + recent trigger history.

### 7.5 AI route generation (onboarding + settings)

**Architecture:**
- Next.js API Route `/api/ai/route` → AI proxy
- Receives: departure port, arrival port, boat specs (draft, air draft, fuel capacity, speed), navigator profile
- Calls Claude Sonnet via AI proxy to generate 2-3 route proposals

**Route generation prompt context:**
- Departure and arrival ports with coordinates
- Boat constraints: draft (port accessibility), air draft (canal bridges), fuel range, average speed
- Navigator profile: experience, crew mode, risk tolerance, night sailing preference
- Geographical knowledge: maritime routes, canal networks, critical passages, typical weather patterns

**AI response format (structured JSON):**
Each route option includes:
- `name`: Route label (e.g. "Via canaux", "Via Gibraltar")
- `summary`: 2-3 sentence description
- `total_distance_nm`: Total maritime distance
- `total_distance_km`: Total canal distance (if applicable)
- `estimated_days`: Estimated duration
- `pros`: List of advantages
- `cons`: List of disadvantages
- `warnings`: Boat-specific warnings (e.g. air draft issues)
- `steps`: Array of route legs, each with `from_port`, `to_port`, `from_lat`, `from_lon`, `to_lat`, `to_lon`, `distance_nm`, `distance_km`, `phase`, `notes`

**Custom route ("Other" option):**
When user provides a free-text description (e.g. "I want to go via Kiel but stop in Amsterdam first"), the AI generates a single custom route matching the description, using the same structured format.

**Post-selection:**
Once the user picks a route, the steps array is inserted into `route_steps` and `boat_status` is initialized at the departure port. The route remains fully editable (add/remove/reorder stops) from the Route page and Settings.

---

## 8. Data architecture (Supabase)

### Tables

Multi-user schema with Row Level Security. Each user sees only their own data.

```sql
-- Users (extended from Supabase Auth)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Boats
CREATE TABLE boats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT, -- e.g. "Laurin Koster 28", "Catamaran"
  length_m DOUBLE PRECISION,
  draft_m DOUBLE PRECISION,
  air_draft_m DOUBLE PRECISION,
  engine_type TEXT, -- 'Diesel', 'Gasoline', 'Electric', 'Sail-only'
  fuel_capacity_hours INTEGER,
  avg_speed_kn DOUBLE PRECISION,
  has_ais_tx BOOLEAN DEFAULT false,
  has_autopilot BOOLEAN DEFAULT false,
  has_radar BOOLEAN DEFAULT false,
  has_watermaker BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Navigation profiles (experience, crew mode, risk tolerance)
CREATE TABLE nav_profiles (
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

-- Voyages
CREATE TABLE voyages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  boat_id UUID NOT NULL REFERENCES boats(id) ON DELETE CASCADE,
  nav_profile_id UUID REFERENCES nav_profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  status TEXT CHECK (status IN ('planning', 'active', 'completed')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Daily briefings
CREATE TABLE briefings (
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
  content TEXT NOT NULL, -- Full briefing in markdown
  weather_data JSONB,
  tide_data JSONB
);

-- Logbook
CREATE TABLE logs (
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

-- Route steps
CREATE TABLE route_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voyage_id UUID NOT NULL REFERENCES voyages(id) ON DELETE CASCADE,
  order_num INTEGER NOT NULL,
  name TEXT NOT NULL,
  from_port TEXT NOT NULL,
  to_port TEXT NOT NULL,
  distance_nm DOUBLE PRECISION,
  distance_km DOUBLE PRECISION,
  phase TEXT CHECK (phase IN ('Atlantic', 'Gironde', 'Garonne Canal', 'Midi Canal', 'Mediterranean')),
  status TEXT CHECK (status IN ('done', 'in_progress', 'to_do')) DEFAULT 'to_do',
  notes TEXT,
  from_lat DOUBLE PRECISION,
  from_lon DOUBLE PRECISION,
  to_lat DOUBLE PRECISION,
  to_lon DOUBLE PRECISION
);

-- Checklist
CREATE TABLE checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voyage_id UUID NOT NULL REFERENCES voyages(id) ON DELETE CASCADE,
  task TEXT NOT NULL,
  category TEXT CHECK (category IN ('Safety', 'Propulsion', 'Navigation', 'Rigging', 'Comfort', 'Admin')),
  priority TEXT CHECK (priority IN ('Critical', 'High', 'Normal', 'Low')),
  status TEXT CHECK (status IN ('to_do', 'in_progress', 'done', 'na')) DEFAULT 'to_do',
  notes TEXT,
  completed_at TIMESTAMPTZ
);

-- Chat history
CREATE TABLE chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  voyage_id UUID NOT NULL REFERENCES voyages(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  context_snapshot JSONB
);

-- Boat status (per voyage, continuously updated)
CREATE TABLE boat_status (
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
```

---

## 9. API Integrations

### Open-Meteo (marine weather)

```
GET https://marine-api.open-meteo.com/v1/marine?
  latitude={lat}&longitude={lon}
  &hourly=wave_height,wave_direction,wave_period,
          wind_wave_height,swell_wave_height,swell_wave_period
  &daily=wave_height_max,wave_period_max
  &wind_speed_unit=kn
  &timezone=Europe/Paris
```

Combined with classic weather API for wind, temperature, visibility:

```
GET https://api.open-meteo.com/v1/forecast?
  latitude={lat}&longitude={lon}
  &hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,
          visibility,precipitation,cloud_cover,temperature_2m
  &wind_speed_unit=kn
  &timezone=Europe/Paris
```

### WorldTides (tides)

```
GET https://www.worldtides.info/api/v3?
  heights&extremes
  &lat={lat}&lon={lon}
  &key={API_KEY}
  &days=3
```

### VNF (canals)

No structured public API. Strategy:
- Periodic scraping of VNF notice page
- Cache storage in Supabase
- Fallback: AI searches for info via web search during briefing

---

## 10. Technical constraints

### Mobile-first

- Responsive design, optimized 360-412px wide (Android standard)
- Touch targets minimum 44x44px
- Usable one-handed
- Readable outdoors (high contrast, min 16px font)
- No hover states (all tap/swipe)

### Limited connectivity

- **Service Worker** for offline cache of pages, assets, and latest data
- **Map tiles pre-cached** for current zone + buffer
- **Sync queue** : log entries stored locally and synced when network returns
- **Degraded mode** : if no API connection, chat shows latest cached data and explains limitations
- **Pre-generated briefing** : stored locally when received at 5am, readable offline all day

### Battery

- No continuous GPS — read on-demand or during log entry
- No background weather polling
- Minimal animations
- Dark mode for OLED power saving

### Security

- **Supabase Auth**: Magic link email (no passwords, works with wet fingers)
- **Row Level Security (RLS)**: All tables have RLS policies — each user can only access their own boats, voyages, briefings, logs, and chat history
- **HTTPS everywhere** (Vercel default)
- **Personal data only in Supabase** (no third-party tracking)
- **API key**: Server-side environment variable (never exposed to client)

---

## 11. MVP vs V1.5 vs V2

> Complete roadmap in [VISION.md](./VISION.md) (V1 → V1.5 → V2 → V3).

### V1 — MVP "First mate for everyone" (to build now, before mid-March)

| Feature | Priority |
|---|---|
| **Onboarding wizard** (boat + profile + AI route proposals) | P0 |
| **Multi-user auth** (Supabase Auth magic link) | P0 |
| Dashboard with verdict + mate messages | P0 |
| Auto daily briefing (via Vercel Cron + server-side AI) | P0 |
| Contextual AI chat (talk to mate) | P0 |
| Map with route and position | P0 |
| Logbook (entry + history) | P0 |
| **Server-side AI proxy** (Claude API via env var) | P0 |
| 5 proactive triggers (weather, log, watch, checklist, fuel) | P0 |
| Push notifications for mate interventions | P1 |
| Checklist with categories | P1 |
| Route with progress | P1 |
| Settings (boat editing, voyage management) | P1 |
| Installable PWA | P1 |
| Offline mode (cache briefing + log queue) | P1 |

### V1.5 — "Skipper's choice" (summer 2026)

| Feature | Description |
|---|---|
| BYOAI option | Users can bring their own Claude API key |
| BYOAI multi-provider | Claude + OpenAI support |
| Advanced triggers | Zone change, provisions, fatigue, multi-day planning |
| Mate memory | Learning skipper's habits and preferences |
| Route builder (advanced) | Drag-and-drop route editing, waypoint library, community-shared routes |
| Port database | Pre-filled + crowdsource enrichment |
| Float plan | Position sharing with loved ones |
| Multilingual | FR + EN |
| Stripe billing | Freemium tiers (Free / Skipper / Pro) |

### V2 — Public product (autumn 2026)

| Feature | Description |
|---|---|
| Freemium + billing | Stripe, Free / Skipper / Pro tiers |
| Enhanced canal mode | Bridge profiles with exact air draft, real-time lock schedules |
| Push notifications | Alert if conditions change during day |
| Export log PDF | Logbook in regulatory format |
| Automatic GPS tracking | Track route during sailing, upload when network |
| AIS integration | Traffic overlay on map |
| Android widget | Today's verdict on home screen |
| SignalK/NMEA integration | Real-time instrument data (V2+) |

---

## 12. UX / Design guidelines

### Principles

1. **10 seconds** — Critical info must be visible without scrolling
2. **One hand** — Everything doable with thumb, in cockpit
3. **Contrast** — Readable in full sun (white background + black text + bright colors for verdicts)
4. **No surprises** — Data must be sourced, timestamped, and AI must indicate confidence level
5. **Offline-aware** — App must never show blank screen. Always show latest data with "updated X ago" indicator

### Color palette (verdicts)

| Verdict | Color | Hex |
|---|---|---|
| GO | Bright green | `#22C55E` |
| STANDBY | Yellow/amber | `#F59E0B` |
| NO-GO | Red | `#EF4444` |
| High confidence | — | No additional badge |
| Medium confidence | — | Badge "⚠️" |
| Low confidence | — | Badge "❓" |

### Navigation

Tab bar at bottom with 5 tabs:
1. 🏠 Dashboard
2. 🗺️ Map
3. 📝 Log
4. 💬 Chat
5. ☰ More (Briefings, Checklist, Route, Settings)

---

## 13. Success metrics

| Metric | Target |
|---|---|
| Time to understand today's verdict | < 10 seconds |
| Time to log an entry | < 30 seconds |
| AI chat response time | < 5 seconds (first token) |
| Briefing availability at 5am | > 95% |
| Recommendation accuracy (self-evaluated by Sébastien) | > 80% of decisions judged "good" |
| Daily usage | Every sailing day |

---

## 14. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| No 4G at sea | No briefing, no chat | Aggressive offline cache, pre-generated briefing at 5am |
| Inaccurate weather API | Wrong decision | Cross Open-Meteo (GFS) with other sources, indicate confidence |
| Claude API cost during free beta | Budget exceeded | Haiku for chat, Sonnet only for briefings, rate limiting per user, cost monitoring dashboard |
| Multiple users → API cost spike | Overages | Usage monitoring, auto-throttling during beta, early upgrade path |
| Supabase free tier full | Data loss | 500MB = years of logs, not realistic risk |
| Sébastien doesn't log | Poorly contextualized briefing | Ultra-fast logging UX, reminder in briefing if last log > 24h |
| RLS misconfiguration | Users see each other's data | Thorough RLS testing, policy audit before launch |

---

## 15. Timeline

| Phase | Duration | Content |
|---|---|---|
| **Setup** | 1 day | Next.js repo, Supabase, Vercel, PWA config |
| **Auth + Onboarding** | 1 day | Supabase Auth (magic link), 4-step onboarding wizard, RLS policies |
| **Backend** | 2 days | Multi-user DB schema, API routes (with user_id, voyage_id), weather/tides integrations, briefing cron |
| **Frontend core** | 3 days | Dashboard, Leaflet map, logbook, route |
| **AI Chat** | 1 day | Chat API + interface + context (server-side key) |
| **Settings + Polish** | 1 day | Boat/profile editing, voyage management, offline, PWA manifest, tests |
| **Test & deploy** | 1 day | Android testing, real data, prod deploy, invite beta testers |
| **Total** | **~10 days** | Ready before departure ~mid-March |

---

---

## 16. Related documents

| Document | Content | Link |
|---|---|---|
| **VISION.md** | Product vision "Skipper AI" — multi-user generalization, business model, go-to-market, roadmap V1→V3 | [VISION.md](./VISION.md) |
| **PRD.md** (this file) | MVP specification — Sébastien's personal app for Audierne → Nice | — |

---

*This document is living. It will be updated as development progresses and Sébastien provides feedback in real conditions. The MVP's architectural choices are guided by the long-term vision described in VISION.md.*
