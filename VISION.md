# Skipper AI — Product Vision

**Version** : 0.2
**Date** : February 27, 2026
**Founder** : Sébastien Treille
**Status** : Vision draft — built from MVP "Bosco"

---

## 1. One-liner

**Skipper AI is your first mate.** It watches, anticipates, organizes, and talks to you — like a real crew member who knows your boat, your route, and your habits.

---

## 2. The Problem (universal)

### Every sailor, every day, performs the same mental exercise

Before casting off, a pleasure boater must weigh:

1. Marine weather (wind, gusts, trend)
2. Sea state (swell, period, cross swell)
3. Tides and currents (times, coefficients, reversals)
4. Planned route (distance, waypoints, hazards)
5. Fallback ports (accessibility, entry conditions)
6. Boat condition (fuel, water, ongoing issues)
7. Crew (fatigue, experience, count)
8. Local regulations (DST, restricted zones, locks)
9. Notices to mariners (nav warnings, works)
10. Your own comfort level and risk tolerance

This process takes 30 minutes to 1 hour. It's done mentally, without record, without systematic method. Judgment errors are the leading cause of maritime accidents.

### What exists today

| Tool | What it does well | What's missing |
|---|---|---|
| Navionics / OpenCPN | Charts, route, waypoints | No integrated weather, no decision support |
| Windy / PredictWind | Marine weather | No boat context, no verdict, no route |
| Tide apps | Tides | No currents, no link to route |
| Paper log book | History | No digital, no analysis |
| Météo France bulletins | Official, reliable | Plain text, no decision support |
| VHF / CROSS | Safety, emergency | Real-time only, no planning |

**No tool cross-references all this data to produce a personalized recommendation.**

### Why now

1. **LLMs are good enough** to reason over multi-source data and produce reliable contextual recommendations.
2. **Free marine weather APIs** (Open-Meteo) have become sufficiently accurate.
3. **PWAs** enable native app experience without going through stores.
4. **The pleasure boating market is growing** : 12M+ pleasure boaters in Europe, 4M+ registered boats.

---

## 3. The Solution: Skipper AI

### The central concept: a First Mate, not a tool

The difference between a navigation tool and a first mate is **proactivity**. A tool waits for you to ask it a question. A first mate watches, anticipates, and comes talk to the captain when it matters.

Skipper AI rests on **three simple blocks** :

**The brain** — An LLM (Claude, GPT, or other) connected to complete boat context. The captain connects their own API key (BYOAI : Bring Your Own AI). The brain has access to everything: position, weather, boat condition, checklist, provisions, history, route, skipper profile. It's an ultra-rich contextual chat, but the complexity is in the prompt, not the code.

**The eyes** — Simple triggers (cron + if/then rules) that monitor continuously and wake the brain when something deserves attention. No ML, no custom model — just clear rules: "if fuel < 25%, alert", "if weather changes >10 knots vs briefing, warn", "if no log in 12h, ask how things are".

**The memory** — The first mate knows the captain. Not just boat specs but habits, preferences, past decisions. "Last time in F5, you found it limiting", "You like to arrive before 4pm", "You haven't refueled in 3 days". Memory grows richer with every interaction and log.

### What a first mate does (vs a tool)

| A navigation tool | A first mate (Skipper AI) |
|---|---|
| Displays the weather | **Wakes you if the weather turns** |
| Shows fuel level | **Tells you "next fuel at 45 NM, ~6h remaining"** |
| Shows the route | **Proposes "48h window Tuesday, you can chain 2 legs"** |
| Has a checklist | **Reminds "lights still broken, departure in 3 days"** |
| Answers questions | **Asks the right questions: "Did you take on water?"** |
| Is generic | **Knows your boat, your habits, your comfort threshold** |
| Waits to be opened | **Sends a notification when it matters** |

### BYOAI: Bring Your Own AI

The captain connects their own API key (Claude or OpenAI) in settings. The app stores the key locally (never on the server). Each LLM call goes through a lightweight proxy that injects context before sending to the chosen provider. The captain pays directly for their API usage — no middleman, no markup.

For those who don't want to manage an API key: a paid tier includes AI access (the simplest option for most users).

### Why KISS

All the "magic" is in the prompt + context, not complex code. The app itself is simple: a database with world state, cron jobs that trigger evaluations, simple rules that detect when to wake the AI, a chat that injects context. No custom ML, no fine-tuning, no distributed architecture.

---

## 4. Target Users

### Personas

#### 🧑‍✈️ The solo navigator (Sébastien — primary persona)

Long-distance solo convoy. Critical need for decision support because no crew for a second opinion. Maximum cognitive load. Ready to pay for a tool that improves safety and reduces stress.

**Market size** : ~500K active solo navigators in Europe.

#### 👨‍👩‍👧‍👦 The couple/family cruising (secondary persona)

Coastal cruise 2-4 weeks. Moderately experienced skipper, non-sailing spouse, sometimes children on board. Need for reassurance: "Is this safe?". Ready to pay for peace of mind.

**Market size** : ~3M coastal cruising boats in Europe.

#### 🏫 The school skipper / charter (tertiary persona)

Takes clients or students. Needs to document (legal logbook), plan routes, and have an educational tool that shows why you leave or don't leave.

**Market size** : ~50K charter/school businesses in Europe.

#### ⛵ The racer (not for MVP)

Very different needs: performance, tactics, optimal routing. Separate market with dedicated tools (Adrena, Expedition). Not our initial target.

---

## 5. What the first mate does

### 5.1 Onboarding: "Tell me who you are"

The key element that makes the app universal. In 3 steps (< 2 minutes) :

**Step 1 — My boat** : name, type (or selection from pre-filled database → auto specs), length, draft/air draft, engine, fuel autonomy, average speed, equipment (AIS, autopilot, radar, watermaker).

**Step 2 — My profile** : experience (beginner → pro), mode (solo/duo/family/crew), risk tolerance, night sailing (yes/no/if_needed), max continuous duration. The AI automatically calibrates its GO/STANDBY/NO-GO thresholds.

**Step 3 — My AI** : connect API key (Claude or OpenAI), or subscribe to paid tier for included AI access.

**Step 4 — My route (optional)** : draw on the map, import a GPX, or simply "From La Rochelle to Lisbon" → AI proposes a route.

### 5.2 The Proactivity System (the "eyes")

The heart of what makes Skipper AI a first mate and not a tool. Simple triggers launch AI interventions:

**Time-based triggers (cron)**

| Trigger | When | First mate's action |
|---|---|---|
| Morning briefing | 5am every day | Complete analysis, verdict GO/STANDBY/NO-GO, nav plan |
| Midday weather check | 1pm if at sea | "Weather changed since this morning: [summary]" |
| Arrival debrief | Arrival detection at port | "Safe arrival? Day summary, suggestions for tomorrow" |
| Log reminder | If no log in 12h | "Hey, all good? A quick log?" |
| Departure eve | 8pm if tomorrow = GO | "Tomorrow is GO. Pre-departure checklist: [5 items]" |
| Multi-day planning | Sunday evening | "Week's weather: window Tuesday-Wednesday, front Thursday" |

**State triggers (if/then)**

| Condition | First mate's action |
|---|---|
| Fuel < 25% | "~Xh of engine remaining. Next fuel: [port] at [X] NM" |
| Weather changes > 10 knots vs briefing | "Alert: wind up to F6, briefing said F4. Fallback port: [port]" |
| Critical checklist item overdue | "Lights still broken, departure in 3 days" |
| Navigation zone change | "Entering the Gulf of Lion. Reminder: mistral, accelerations, no shelter for 55 NM" |
| New VNF warning | "Lock at Saint-Roch reopens March 20, changes your plan" |
| Fresh water < 25% | "~X liters water remaining. Next water point: [port]" |
| No position in 24h | Alert to float plan contacts |
| Weather model divergence | "GFS and ECMWF diverge for tomorrow. Moving to STANDBY as precaution" |

**Contextual triggers**

| Situation | First mate's action |
|---|---|
| Arrival at a port | "Welcome to [port]. VHF channel [X], harbormaster [tel]. Fuel: yes. Supermarket: 400m" |
| 3 days at port (no weather reason) | "Been here 3 days. Possible window tomorrow, want me to analyze?" |
| Eve of critical passage (Raz, Gironde, GdL) | "Raz de Sein is tomorrow. Reminder conditions: current [X], optimal slot [time], Plan B [port]" |
| Low provisions (estimated) | "Arriving La Rochelle tomorrow. ~2d water left, no supermarket before Royan" |

### 5.3 State Management (what the first mate watches)

The first mate maintains an internal dashboard of everything concerning the boat and voyage:

**Boat condition** — fuel (estimated between logs, based on average consumption + distance), fresh water, ongoing issues, checklist status, engine hours since last service.

**Provisions** — intelligent estimation based on remaining voyage duration, consumption rate, and ports with services on route. The first mate doesn't ask "how much is left" but proposes "I think ~2 days remaining, is that right?" — confirmation rather than input.

**Crew fatigue** — continuous navigation hours, last full night, consecutive navigation days. "You did 14h of nav yesterday and want to leave at 6am — STANDBY for fatigue even if weather is GO."

**Progress** — where are we on the route, how much left, estimated ETA with typical weather windows, days ahead/behind vs initial plan.

### 5.4 Dashboard

Adapted to profile (family = simple language, experienced solo = raw data, canal = locks and bridges). Displays **first mate's messages** as priority — not just data, but sentences: "GO today, ideal departure 7:30am with the current. Wind F4 easing." The verdict is always visible in 10 seconds.

### 5.5 The Chat (talk to your first mate)

The captain talks to their first mate like a human. The first mate has complete context all the time.

Examples of natural conversation:
- "Where are we at?" → situation summary (position, weather, levels, next leg)
- "What's the plan?" → nav plan for the day or coming days
- "Hesitating about leaving" → analysis of pros/cons with current context
- "Find me a calm anchorage tonight" → suggestions based on position, weather, preferences
- "How many days to Bordeaux?" → estimation based on actual pace + weather windows
- "Hearing a weird noise in the engine" → diagnostic checklist, port with mechanic suggestion
- "Make me a shopping list for La Rochelle" → based on estimated provisions + remaining duration

**BYOAI** : the chat uses the provider chosen by the captain (Claude or OpenAI). The proxy injects the system prompt + complete context before each call. The captain gets the quality of the best available model and pays directly to their provider.

**Profile adaptation** :
- Beginner → educational, explains terms, reassuring
- Experienced → direct, raw data, frank recommendations
- Multilingual: FR, EN, DE, ES, IT, NL, SV
- Voice (V2) : voice input hands on the wheel

### 5.6 Proactive Planning

The first mate doesn't just give today's verdict — it looks 3 to 5 days ahead:

- "48h window opening Tuesday. If you leave Tuesday 6am, you can chain Lorient → Belle-Île → Le Croisic before Thursday's front."
- "Mistral forecast for 3 days starting Friday. Worth pushing to Marseille tomorrow to shelter."
- "Fonseranes lock closed Monday. If you pass Béziers today, you avoid 1 day delay."

### 5.7 Enriched Map + Crowdsourced Port Database

Same as previous version: Leaflet map, route, fallback ports, danger zones, OpenSeaMap overlay. Plus a port database with profiles (VHF, services, shelter, prices, sailor reviews). Sailors enrich the database with each passage.

### 5.8 Smart Logbook

The first mate takes the lead:
- **Automatic detection** : speed > 3 kn → "Just left?", speed < 1 kn at port → "Arrived?"
- **Estimation between logs** : "I think ~3/4 tank and 3 jerrycans left. Right?" → captain confirms instead of entering
- **PDF export** in regulatory format (charter/school)
- **Statistics** : nautical miles covered, nav hours, engine hours, average consumption

### 5.9 Float Plan

Position sharing for loved ones (public web link, no app required) : position on map, day's plan, status, weather. Inactivity alert if no log in X hours.

### 5.10 Canal Mode

Linear view of the canal with locks, bridges (exact high water time), stops, services. Day planning ("X locks if you leave at [time]"), water level alerts, VNF integration.

### 5.11 Smart Checklist

The first mate manages checklists:
- **Templates** : pre-departure, crossing, winterization, launching, port arrival
- **Proactive reminders** : critical items unchecked + imminent departure = alert
- **Pre-departure check** : proposed automatically when verdict is GO
- **Suggestions** : the first mate can add items based on context ("check mooring, wind forecast tonight")

### 5.12 SignalK / NMEA Integration (V2+)

For equipped boats: read instruments via SignalK (true wind, speed, depth, heading, AIS). The first mate has live data + forecasts → ultra-precise recommendations and automatic alerts.

---

## 6. Technical Architecture

### Principles: KISS

1. **Complexity is in the prompt, not the code.** The app is a simple orchestrator that injects the right context at the right time into an LLM.
2. **No custom ML.** Everything relies on well-prompted generic LLMs.
3. **Triggers are if/then.** No complex rules engine — just cron jobs + simple conditions evaluated at each check.
4. **BYOAI.** The app is agnostic to the AI provider. A unified proxy translates calls.

### Stack

```
┌──────────────────────────────────────────────────┐
│                FRONTEND (PWA)                    │
│  Next.js + React + Tailwind + Leaflet            │
│  i18n (next-intl) — FR/EN/DE/ES/IT/NL/SV        │
│  Service Worker + IndexedDB (offline)            │
│  Push Notifications (Web Push API)               │
├──────────────────────────────────────────────────┤
│                API ROUTES                        │
│  /api/ai/proxy     → BYOAI proxy (Claude/OpenAI)│
│  /api/ai/triggers  → Trigger evaluation         │
│  /api/briefing     → IA briefing generation     │
│  /api/chat         → Contextual copilot chat    │
│  /api/weather      → Open-Meteo proxy           │
│  /api/tides        → WorldTides proxy           │
│  /api/ports        → Port database CRUD         │
│  /api/float-plan   → Public position            │
│  /api/route        → Route builder + AI         │
├──────────────────────────────────────────────────┤
│             TRIGGER ENGINE                       │
│  Vercel Cron → /api/ai/triggers                 │
│  Evaluate rules for each active user            │
│  If condition = true → LLM call → notification  │
│  Rules: fuel, weather, checklist, fatigue,      │
│  zone, VNF, inactivity, multi-day planning      │
├──────────────────────────────────────────────────┤
│               SUPABASE                           │
│  PostgreSQL + Auth + Storage + Realtime         │
│  Row Level Security (multi-tenant)              │
│  Edge Functions (webhooks, notifications)       │
│  Table ai_config (API key, provider, prefs)     │
│  Table trigger_log (intervention history)       │
│  Table memory (learning, habits)                │
├──────────────────────────────────────────────────┤
│           BYOAI PROXY                            │
│  Receives: {message, context}                   │
│  Read user ai_config → provider + API key       │
│  Build system prompt + complete context         │
│  Route to Claude API or OpenAI API              │
│  Return streamed response                       │
│  API key never stored server-side (encrypted    │
│  locally or Supabase Vault)                     │
├──────────────────────────────────────────────────┤
│            EXTERNAL SERVICES                     │
│  Open-Meteo (weather + marine, free)            │
│  WorldTides (tides, ~$2/month)                  │
│  Claude API / OpenAI API (via BYOAI)            │
│  AISHub / MarineTraffic (AIS, V2)               │
│  SignalK (instruments, V2)                      │
│  OpenSeaMap (nautical tiles)                    │
│  Web Push (proactive notifications)             │
└──────────────────────────────────────────────────┘
```

### Database Schema (additions vs MVP)

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  email TEXT UNIQUE,
  name TEXT,
  language TEXT DEFAULT 'fr',
  timezone TEXT DEFAULT 'Europe/Paris',
  onboarding_completed BOOLEAN DEFAULT false
);

-- AI Configuration (BYOAI)
CREATE TABLE ai_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) UNIQUE,
  provider TEXT CHECK (provider IN ('claude', 'openai', 'managed')) DEFAULT 'managed',
  api_key_encrypted TEXT, -- Encrypted key, or NULL if managed tier
  model_chat TEXT DEFAULT 'claude-haiku-4-5', -- Chat model
  model_briefing TEXT DEFAULT 'claude-sonnet-4-5', -- Briefing model
  proactivity_level TEXT CHECK (proactivity_level IN ('minimal', 'normal', 'maximal')) DEFAULT 'normal',
  quiet_hours_start TIME DEFAULT '22:00', -- No notifs between quiet_start and quiet_end
  quiet_hours_end TIME DEFAULT '05:00',
  tone TEXT CHECK (tone IN ('formal', 'casual', 'technical')) DEFAULT 'casual'
);

-- Boats (one user can have multiple boats)
CREATE TABLE boats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  type TEXT, -- 'Jeanneau Sun Odyssey 349', 'Laurin Koster 28', etc.
  length_m DOUBLE PRECISION,
  draft_m DOUBLE PRECISION,
  air_draft_m DOUBLE PRECISION,
  engine_type TEXT, -- 'diesel', 'petrol', 'electric', 'none'
  fuel_capacity_hours DOUBLE PRECISION,
  avg_speed_kn DOUBLE PRECISION DEFAULT 5.0,
  has_ais_tx BOOLEAN DEFAULT false,
  has_autopilot TEXT CHECK (has_autopilot IN ('yes', 'no', 'unstable')) DEFAULT 'no',
  has_radar BOOLEAN DEFAULT false,
  has_watermaker BOOLEAN DEFAULT false,
  photo_url TEXT
);

-- Navigation profiles
CREATE TABLE nav_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  boat_id UUID REFERENCES boats(id),
  experience TEXT CHECK (experience IN ('beginner', 'intermediate', 'experienced', 'pro')),
  crew_mode TEXT CHECK (crew_mode IN ('solo', 'duo', 'family', 'crew')),
  crew_count INTEGER DEFAULT 1,
  risk_tolerance TEXT CHECK (risk_tolerance IN ('cautious', 'moderate', 'bold')),
  night_sailing TEXT CHECK (night_sailing IN ('yes', 'no', 'if_needed')),
  max_continuous_hours INTEGER DEFAULT 12,
  -- Auto-calculated decision thresholds by AI
  max_wind_bf INTEGER, -- Go/no-go max wind
  max_sea_height DOUBLE PRECISION, -- Go/no-go max sea
  min_visibility_nm DOUBLE PRECISION -- Go/no-go min visibility
);

-- Voyages (one user can have multiple voyages)
CREATE TABLE voyages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  boat_id UUID REFERENCES boats(id),
  profile_id UUID REFERENCES nav_profiles(id),
  name TEXT NOT NULL, -- 'Audierne → Nice', 'Transatlantic 2026', etc.
  status TEXT CHECK (status IN ('planning', 'in_progress', 'completed', 'abandoned')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Route steps linked to a voyage
CREATE TABLE route_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voyage_id UUID REFERENCES voyages(id),
  -- ... (same as MVP + voyage_id)
);

-- Briefings linked to a voyage
CREATE TABLE briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voyage_id UUID REFERENCES voyages(id),
  -- ... (same as MVP + voyage_id)
);

-- Logs linked to a voyage
CREATE TABLE logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voyage_id UUID REFERENCES voyages(id),
  -- ... (same as MVP + voyage_id)
);

-- Port database (shared across all users)
CREATE TABLE ports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  port_type TEXT CHECK (port_type IN ('marina', 'commercial_port', 'anchorage', 'lock', 'river_stop')),
  vhf_channel TEXT,
  phone TEXT,
  website TEXT,
  fuel BOOLEAN DEFAULT false,
  water BOOLEAN DEFAULT false,
  electricity BOOLEAN DEFAULT false,
  wifi BOOLEAN DEFAULT false,
  shipchandler BOOLEAN DEFAULT false,
  supermarket_distance_m INTEGER,
  entry_depth_m DOUBLE PRECISION,
  has_sill BOOLEAN DEFAULT false, -- Sill gate
  sill_height_m DOUBLE PRECISION,
  shelter JSONB, -- {"N": "good", "NE": "fair", "E": "good", "SE": "poor", ...}
  avg_price_per_night DOUBLE PRECISION, -- EUR
  fuel_price_per_liter DOUBLE PRECISION
);

-- Port reviews (crowdsourced)
CREATE TABLE port_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  port_id UUID REFERENCES ports(id),
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  visited_at DATE,
  boat_length_m DOUBLE PRECISION, -- For contextualizing the review
  photos TEXT[] -- URLs
);

-- Float plan (position sharing)
CREATE TABLE float_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voyage_id UUID REFERENCES voyages(id),
  user_id UUID REFERENCES users(id),
  share_token TEXT UNIQUE NOT NULL, -- Token in public URL
  active BOOLEAN DEFAULT true,
  contacts JSONB, -- [{"name": "Marie", "email": "...", "phone": "..."}]
  inactivity_alert_hours INTEGER DEFAULT 12
);

-- Log of proactive first mate interventions
CREATE TABLE trigger_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID REFERENCES users(id),
  voyage_id UUID REFERENCES voyages(id),
  trigger_type TEXT NOT NULL, -- 'weather_change', 'fuel_low', 'checklist_reminder', etc.
  trigger_condition JSONB, -- The condition that triggered the intervention
  message TEXT NOT NULL, -- The message sent to the captain
  acknowledged BOOLEAN DEFAULT false, -- Did the captain read/respond
  acknowledged_at TIMESTAMPTZ
);

-- First mate memory (what it learns about the captain)
CREATE TABLE memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  category TEXT CHECK (category IN ('preference', 'habit', 'decision', 'feedback', 'note')),
  content TEXT NOT NULL, -- "Prefers to arrive before 4pm", "Finds F5 limiting solo", etc.
  source TEXT, -- 'log', 'chat', 'decision', 'explicit' — source of this info
  confidence DOUBLE PRECISION DEFAULT 0.5, -- 0-1, increases with repetition
  last_referenced_at TIMESTAMPTZ -- When this memory was last used
);

-- Provisions / consumables (smart tracking)
CREATE TABLE provisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voyage_id UUID REFERENCES voyages(id),
  item TEXT NOT NULL, -- 'water', 'fuel', 'food', 'gas'
  quantity_current DOUBLE PRECISION, -- Current estimated quantity
  quantity_unit TEXT, -- 'liters', 'days', 'bottles'
  quantity_max DOUBLE PRECISION, -- Max capacity
  consumption_rate DOUBLE PRECISION, -- Consumption per day (auto-calculated)
  last_refill_at TIMESTAMPTZ,
  last_refill_port TEXT,
  next_available_port TEXT, -- Next port with this service
  next_available_distance_nm DOUBLE PRECISION
);
```

---

## 7. AI Decision Profiles

### How AI adapts to the profile

The AI doesn't give the same verdict to a beginner in a family and an experienced solo navigator. Here's the calibration matrix:

| Criterion | Beginner cautious (family) | Intermediate moderate | Experienced bold (solo) |
|---|---|---|---|
| Max wind GO | F4 (16 knots) | F5 (21 knots) | F6 (27 knots) |
| Max gusts GO | F5 (21 knots) | F6 (27 knots) | F7 (33 knots) |
| Max sea GO | 1.0m | 1.5m | 2.5m |
| Cross sea | NO-GO | STANDBY | GO if fallback close |
| Min visibility | 5 NM | 3 NM | 1 NM (with radar) |
| Night sailing | NO-GO | If necessary | OK if conditions good |
| Max continuous nav | 6h | 12h | 24h |
| Model divergence | NO-GO | STANDBY | STANDBY (unless ultra-clean window) |
| Critical passages (Raz, GdL...) | Avoid or perfect conditions | Good conditions required | Acceptable conditions + precise plan |

*These are defaults that refine with skipper feedback. If AI recommends STANDBY and the skipper leaves anyway and it goes well → AI learns that this skipper is more tolerant than their declared profile.*

### Learning Loop

1. AI recommends GO/STANDBY/NO-GO
2. Skipper decides (leaves or stays)
3. Skipper logs conditions actually encountered
4. AI compares recommendation vs reality vs skipper's decision
5. Progressive adjustment of personalized thresholds

This isn't complex ML — it's simple Bayesian threshold adjustment stored in `nav_profiles`.

---

## 8. Business Model

### Freemium + BYOAI

| Tier | Price | AI | Features |
|---|---|---|---|
| **Free** | €0 | No AI (dashboard + map + basic log) | Weather dashboard, map, logbook (10 entries), 1 voyage |
| **BYOAI** | €4.99/month | Your own API key (Claude/OpenAI) | Everything unlimited: proactive first mate, chat, briefings, route builder, checklist, float plan, triggers |
| **Skipper** | €12.99/month | AI included (we pay API for you) | Same as BYOAI but no API key management — simplest option |
| **Pro** | €24.99/month | AI included + premium | Multi-boat, crew, SignalK, PDF export, API, commercial use |

### Why this model

- **BYOAI at €4.99** is the killer: tech-savvy power users (solo navigators, open source community) pay almost nothing. Their API cost (~€2-5/month) is their responsibility, and €4.99 easily covers infra (Supabase, Vercel, weather). Margin: ~80%.
- **Skipper at €12.99** for those who don't want to manage API keys. AI cost (~€2-3/user/month) + infra (~€1) leaves ~75% margin.
- **Free** for acquisition: free weather dashboard suffices for many occasional sailors.
- **Pro** for charter/school segment needing business features.

### Revenue Potential

| Segment | Base | Penetration | Mix BYOAI/Skipper/Pro | MRR |
|---|---|---|---|---|
| Solo (tech-savvy) | 500K | 1% = 5K | 60% BYOAI = 3K × €4.99 | €15K |
| Cruising (wants simple) | 3M | 0.5% = 15K | 80% Skipper = 2.4K × €12.99 | €31K |
| Charter/school | 50K | 2% = 1K | 50% Pro = 500 × €24.99 | €12.5K |
| **Total** | | | | **~€58K/month** |

---

## 9. Go-to-Market

### Phase 1: Sébastien's Voyage (March-May 2026)

- App is built and used in real conditions on Audierne → Nice convoy
- Organic content: Instagram/YouTube posts of the voyage with app visible
- Direct feedback loop: founder IS user #1
- At arrival in Nice: demo video, blog post "How AI helped me navigate 1500 NM solo"

### Phase 2: Private Beta (Summer 2026)

- Opening to 50-100 beta testers via sailing forums (Hisse et Oh, YBW, Cruisers Forum)
- Focus France + UK + Netherlands (big pleasure sailing markets, strong solo/cruising culture)
- Fast iterations based on feedback

### Phase 3: Public Launch (Fall 2026)

- PWA publicly available
- Free tier for acquisition
- Partnerships: sailing schools, charter companies, shipchandlers (flyer distribution)
- PR: nautical media (Voiles et Voiliers, Yachting Monthly, Zeilen)

### Phase 4: Expansion (2027)

- Full Mediterranean + Atlantic + Channel + Baltic coverage
- SignalK integration
- Native iOS + Android apps if needed
- API for integrators (third-party apps, plotter makers)

---

## 10. Competition

| Actor | Strength | Weakness vs Skipper AI |
|---|---|---|
| **PredictWind** | Excellent offshore routing | Passive (not proactive), no log, no chat, no boat context |
| **Windy** | Weather visualization | Shows data, doesn't produce decisions |
| **Navionics** | Best-in-class nautical charts | Charting tool, not a copilot |
| **OpenCPN** | Open source, free | Desktop-only, no AI, no proactivity |
| **SailGrib** | Mobile weather routing | Complex, no chat, no state tracking |
| **NoForeignLand** | Community, port database | No weather, no AI, no planning |
| **OpenClaw** (ref) | Configurable AI assistant | Generic, not navigation-specialized |

**Our angle** : no competitor is **proactive**. All wait for you to open them. Skipper AI comes talk to the captain when it matters. That's the difference between a dashboard and a crew member.

---

## 11. Product Roadmap

### V1 — MVP "My Personal First Mate" (March 2026)

Scope: current MVP PRD ("Bosco"). Sébastien's personal use. First proactive triggers (morning briefing, midday weather check, log reminder). Contextual chat. BYOAI with Sébastien's Claude key.

### V1.5 — "First Mate for Everyone" (June 2026)

- Onboarding (my boat, my profile, my AI)
- Full BYOAI (Claude + OpenAI)
- Multi-user (Supabase auth)
- Complete trigger engine (all rules from section 5.2)
- Basic route builder
- Port database (pre-filled + crowdsourced)
- First mate memory (memory table)
- Float plan
- Multilingual (FR + EN)

### V2 — "The Real First Mate" (September 2026)

- Freemium + BYOAI + billing (Stripe)
- Smart provisions tracking
- Fatigue estimation
- Proactive multi-day planning
- Enriched canal mode
- Proactive push notifications
- PDF log export
- DE + ES + IT + NL

### V3 — "The Perfect Crew Member" (2027)

- SignalK / NMEA integration (live instrument data)
- AIS overlay
- Voice input (hands on wheel)
- Advanced AI learning loop (threshold calibration)
- Public API
- Native apps if PWA is insufficient

---

## 12. Metrics

### Product

| Metric | V1 | V1.5 | V2 |
|---|---|---|---|
| Active users | 1 (Sébastien) | 50-100 (beta) | 5K+ |
| Briefings generated/day | 1 | 50-100 | 5K+ |
| Verdict time (< 10s) | Measured | 90%+ | 95%+ |
| Log time (< 30s) | Measured | 80%+ | 90%+ |
| Day 7 retention | N/A | 70%+ | 60%+ |
| NPS | N/A | 50+ | 40+ |

### Business

| Metric | V2 (launch) | V2 +6 months | V3 |
|---|---|---|---|
| Total users | 1K | 5K | 20K |
| Paying users | 200 | 1K | 4K |
| MRR | €2K | €10K | €40K |
| Monthly churn | < 5% | < 5% | < 3% |

---

## 13. Product Risks

| Risk | Impact | Mitigation |
|---|---|---|
| AI makes a bad recommendation → accident | Catastrophic (legal + reputation) | Clear disclaimer ("decision support, skipper remains responsible"), confidence level systematic, complete logging for audit |
| Sailors don't trust AI | No adoption | Verdict is transparent (sourced data, explicit reasoning), sailor can always override |
| Claude API cost too high at scale | Negative margins | Haiku by default, Sonnet only for briefings, cache frequent responses, dedicated fine-tuned model if volume |
| Not enough tech-savvy sailors | Limited market | Simple PWA (no geek tax), guided onboarding, market is rejuvenating (30-50 year-olds are digital natives) |
| Maritime regulation | Blocking | Position as "decision support" not "navigation system", like PredictWind does |

---

---

## 14. The Founding Principle

> **A tool displays data. A first mate takes initiative.**
>
> Skipper AI doesn't ask the captain to open the app to check the weather. It sends them a message when the weather changes. It doesn't ask to enter fuel level — it estimates it and asks confirmation. It doesn't settle for today's verdict — it looks ahead at the week and proposes a plan.
>
> The complexity is in the prompt and context, not the code. The app stays simple. The first mate is intelligent.

---

*This document is the long-term vision. [PRD.md](./PRD.md) remains the reference for the MVP that will be built first. The vision guides MVP architectural choices so it's extensible toward the complete product.*
