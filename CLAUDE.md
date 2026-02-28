# Bosco — Claude Code Project Context

## What is this project?

**Bosco** is an AI-powered sailing first mate — a multi-user PWA that helps sailors make daily go/no-go decisions and navigate safely. Built initially for Sébastien's solo convoy from Audierne (Finistère, France) to Nice, but designed for any sailor from day 1.

It's NOT just a dashboard. It's a **proactive copilot** that monitors, anticipates, and talks to the captain when something needs attention.

## Key Documents

- **[PRD.md](./PRD.md)** — MVP specification
- **[VISION.md](./VISION.md)** — Long-term product vision (Skipper AI, BYOAI, freemium)
- **[BUILD_PLAN.md](./BUILD_PLAN.md)** — Sequenced build steps with progress markers

**Always read PRD.md before starting any feature work.** It contains the complete spec, DB schema, API details, and UX requirements.

## Implementation Status (updated 2026-02-28)

**MVP is feature-complete** (~17,000 lines of source code). All pages, API routes, AI agentic system, and database are implemented.

| Area | Status | Lines |
|------|--------|-------|
| Auth (magic link + middleware) | Done | ~240 |
| Onboarding (4-step wizard + AI routes) | Done | ~1,040 |
| Dashboard | Done | ~973 |
| Map (Leaflet + OpenSeaMap + dark mode) | Done | ~381 |
| Logbook (entry + GPS + history) | Done | ~1,018 |
| AI Chat (streaming + agentic tools) | Done | ~587 |
| Briefings (generation + markdown + history + delete) | Done | ~566 |
| Checklist (categories + priorities) | Done | ~615 |
| Route progress + editing | Done | ~967 |
| Reminders | Done | ~315 |
| Settings (boat + profile + voyages) | Done | ~1,517 |
| More menu | Done | ~115 |
| API routes (9 endpoints) | Done | ~1,634 |
| AI system (proxy + context + prompts + tools + handlers) | Done | ~2,481 |
| Trigger engine (5 rules) | Done | ~467 |
| Weather + Tides clients | Done | ~302 |
| Supabase (types + queries + clients + storage) | Done | ~1,152 |
| Theme system (dark/light/system) | Done | ~84 |
| PWA (manifest + Service Worker) | Done | ~136 |
| DB schema (6 migrations) | Done | ~469 |
| Shared components (AIRouteWizard, MiniMap, etc.) | Done | ~1,164 |
| Hooks (geo, push, online, SW) | Done | ~188 |

**Not yet done (planned for polish/deploy):**
- Advanced offline sync (Service Worker caches shell, but IndexedDB log queue partial)
- Vercel production deployment optimization
- Lighthouse PWA audit

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS 4 |
| Map | Leaflet + react-leaflet + OpenSeaMap overlay + CartoDB Dark Matter (dark mode) |
| Backend | Next.js API Routes (Route Handlers) |
| Database | Supabase (PostgreSQL + Auth + Realtime) |
| Auth | Supabase Auth (magic link email) |
| AI | Claude API — server-side key (Anthropic SDK) |
| Weather | Open-Meteo (free, no key) |
| Tides | WorldTides API |
| Hosting | Vercel |
| Push | Web Push API + Vercel Cron Jobs |
| PWA | Custom Service Worker (public/sw.js) |

## Architecture Principles

1. **KISS** — All intelligence is in the LLM prompt + context injection. No ML, no fine-tuning, no complex event processing.
2. **Server-side AI** — Single `ANTHROPIC_API_KEY` in env vars. Free during beta. BYOAI (user brings own key) planned for V1.5.
3. **Multi-user from day 1** — Supabase Auth, RLS on all tables. Each user has their own boat, profile, voyage, and data.
4. **Offline-first** — Service Worker caches briefings, tiles, and last known state. Log entries queue locally and sync when network returns.
5. **Mobile-first** — Designed for one-handed cockpit use on Android phone. Touch targets ≥ 44px. High contrast. No hover states.

## Project Structure (actual)

```
src/
├── middleware.ts                    # Auth guard (redirect unauthenticated) [100 lines]
├── instrumentation.ts              # Auto-run DB migrations at server startup [6 lines]
├── app/
│   ├── layout.tsx                  # Root layout (PWA meta, viewport-fit cover)
│   ├── globals.css                 # Tailwind base styles + prose-briefing CSS [255 lines]
│   ├── login/page.tsx              # Magic link login
│   ├── onboarding/page.tsx         # 4-step onboarding wizard [1,040 lines]
│   ├── auth/callback/route.ts      # Supabase Auth callback
│   ├── (app)/                      # Protected route group
│   │   ├── layout.tsx              # App shell (auth check, BottomNav, safe area)
│   │   ├── page.tsx                # Dashboard [973 lines]
│   │   ├── map/page.tsx            # Map page (loads MapView)
│   │   ├── map/MapView.tsx         # Leaflet + OpenSeaMap + dark mode tiles [245 lines]
│   │   ├── log/page.tsx            # Logbook (entry + history) [1,018 lines]
│   │   ├── chat/page.tsx           # AI Chat (streaming + agentic tools) [587 lines]
│   │   ├── briefings/page.tsx      # Briefing history + markdown rendering [566 lines]
│   │   ├── checklist/page.tsx      # Checklist (categories + priorities) [615 lines]
│   │   ├── route/page.tsx          # Route progress + editing [967 lines]
│   │   ├── reminders/page.tsx      # Reminders management [315 lines]
│   │   ├── settings/page.tsx       # Boat/profile/voyage management [1,517 lines]
│   │   └── more/page.tsx           # More menu [115 lines]
│   └── api/
│       ├── ai/proxy/route.ts       # Claude API proxy (streaming) [86 lines]
│       ├── ai/route/route.ts       # AI route proposals (Claude Sonnet) [300 lines]
│       ├── ai/triggers/route.ts    # Trigger evaluation (cron) [169 lines]
│       ├── ai/memory-extract/route.ts # AI memory extraction (cron) [300 lines]
│       ├── briefing/route.ts       # Daily briefing generation (cron) [332 lines]
│       ├── chat/route.ts           # Chat endpoint (streaming + tool_use) [226 lines]
│       ├── push/route.ts           # Push notification subscription [100 lines]
│       ├── weather/route.ts        # Open-Meteo proxy [52 lines]
│       └── tides/route.ts          # WorldTides proxy [69 lines]
├── components/
│   ├── Providers.tsx               # React context providers (Auth + Theme) [12 lines]
│   ├── layout/BottomNav.tsx        # Bottom tab bar (5 tabs) [64 lines]
│   ├── map/
│   │   └── MiniMapView.tsx         # Mini Leaflet map for dashboard/route [104 lines]
│   ├── voyage/
│   │   ├── AIRouteWizard.tsx       # AI route proposal + selection wizard [690 lines]
│   │   └── RoutePreviewMap.tsx     # Route preview map with waypoints [237 lines]
│   └── ui/
│       ├── Card.tsx                # Reusable card (auto-detects custom bg) [39 lines]
│       ├── LoadingSpinner.tsx      # Loading indicator [25 lines]
│       └── Skeleton.tsx            # Skeleton loading placeholder [7 lines]
├── lib/
│   ├── supabase/
│   │   ├── client.ts              # Browser Supabase client
│   │   ├── server.ts              # Server Supabase client (SSR)
│   │   ├── admin.ts               # Admin client (service role)
│   │   ├── storage.ts             # Supabase Storage helpers [37 lines]
│   │   ├── types.ts               # Generated DB types [722 lines]
│   │   └── queries.ts             # User-scoped query helpers [327 lines]
│   ├── auth/
│   │   ├── context.tsx            # AuthContext provider [81 lines]
│   │   └── hooks.ts               # useAuth() + useUser() + useActiveVoyage() [181 lines]
│   ├── ai/
│   │   ├── proxy.ts               # Server-side Claude proxy [276 lines]
│   │   ├── prompts.ts             # System prompts (briefing, chat, trigger, route) [578 lines]
│   │   ├── context.ts             # Context builder [323 lines]
│   │   ├── tools.ts               # AI tool definitions (7 tools) [290 lines]
│   │   ├── tool-handlers.ts       # Tool execution handlers [743 lines]
│   │   └── route.ts               # Route proposal logic [271 lines]
│   ├── weather/
│   │   ├── open-meteo.ts          # Open-Meteo client [155 lines]
│   │   └── worldtides.ts          # WorldTides client [147 lines]
│   ├── triggers/
│   │   ├── engine.ts              # Trigger evaluation engine [213 lines]
│   │   └── rules.ts               # 5 MVP trigger rules [254 lines]
│   ├── theme.tsx                   # Theme system (dark/light/system) [84 lines]
│   ├── db/migrate.ts              # Auto-migration runner [71 lines]
│   ├── offline-queue.ts           # Offline log queue [71 lines]
│   ├── utils.ts                   # Format dates, distances, coordinates [113 lines]
│   └── push.ts                    # Web Push subscription [84 lines]
├── hooks/
│   ├── useGeolocation.ts          # Browser GPS [49 lines]
│   ├── usePushNotifications.ts    # Push notification setup [102 lines]
│   ├── useOnlineStatus.ts         # Online/offline detection [24 lines]
│   └── useServiceWorker.ts        # SW registration [13 lines]
└── types/
    └── index.ts                   # Shared TypeScript types [192 lines]
public/
├── manifest.json                  # PWA manifest
├── sw.js                          # Service Worker
└── icons/                         # PWA icons (192, 512, SVG + PNG)
supabase/
└── migrations/
    ├── 001_initial.sql            # Full schema with RLS [302 lines]
    ├── 002_reminders.sql          # Reminders table [57 lines]
    ├── 003_push_subscriptions.sql # Push subscription table [37 lines]
    ├── 004_photo_urls.sql         # Photo URLs column [4 lines]
    ├── 005_relax_phase_check.sql  # Relax route phase constraint [4 lines]
    └── 006_ai_memory.sql          # AI memory + versions tables [65 lines]
```

**Note**: Most page logic is inline (not split into separate components). Shared components are extracted into `components/voyage/` (route wizard) and `components/map/` (mini map).

## Database

Full schema is in PRD.md section 8. 6 migrations in `supabase/migrations/`.

### Core tables (001_initial.sql)
- `users` — User profiles (linked to Supabase Auth)
- `boats` — Boat specs per user (name, dimensions, engine, equipment)
- `nav_profiles` — Navigator profiles (experience, risk tolerance, crew mode)
- `voyages` — Voyages per user (name, status, boat, profile)
- `boat_status` — Current boat state per voyage (position, fuel, water, problems)
- `briefings` — Daily AI briefings with verdict (GO/STANDBY/NO-GO)
- `logs` — Logbook entries (position, fuel, water, notes)
- `route_steps` — Route legs per voyage
- `checklist` — Categorized tasks with priority per voyage
- `chat_history` — Chat messages with context snapshots

### Added tables (migrations 002-006)
- `reminders` — Scheduled reminders per voyage (title, message, remind_at, recurring)
- `push_subscriptions` — Web Push subscriptions per user (endpoint, keys)
- `ai_memory` — Persistent AI memory docs (4 slugs: situation, boat, crew, preferences)
- `ai_memory_versions` — Version history for AI memory documents

**All tables have `user_id` (NOT NULL) and most have `voyage_id` (NOT NULL).** RLS enforces data isolation per user.

## Auth & Onboarding

### Auth Flow
- Supabase Auth with magic link (email, no password)
- Protected routes: redirect to `/login` if not authenticated
- Redirect to `/onboarding` if `onboarding_completed = false`

### Onboarding Wizard (4 steps)
1. **My Boat** — name, type, length, draft, air draft, engine, fuel capacity, speed, equipment
2. **My Profile** — experience, crew mode, risk tolerance, night sailing, max hours
3. **My Voyage** — AI-assisted route creation:
   - User enters departure + arrival ports
   - `/api/ai/route` calls Claude Sonnet → generates 2-3 route options (with distance, duration, pros/cons, boat-specific warnings)
   - User selects one option, OR chooses "Other" and describes route in free text → AI generates custom route
   - Preview on interactive map, user can adjust waypoints
   - Route steps saved to `route_steps`, boat_status initialized
   - Can skip and add route later
4. **Done** — redirect to dashboard

## AI System

### Architecture

The AI system is **agentic**: the chat uses Claude with native `tool_use` (7 tools, max 5 agentic turns, SSE streaming). The AI can take actions (create logs, manage checklist, update route, etc.) autonomously.

Key files:
- `src/lib/ai/tools.ts` — Tool definitions (JSON schemas for Claude tool_use)
- `src/lib/ai/tool-handlers.ts` — Tool execution (Supabase mutations)
- `src/lib/ai/prompts.ts` — System prompts (briefing, chat, trigger, route)
- `src/lib/ai/context.ts` — Context builder (gathers all voyage data)
- `src/lib/ai/proxy.ts` — Server-side Claude proxy
- `src/lib/ai/route.ts` — Route proposal logic

### 7 AI Tools (agentic chat)

| Tool | Actions | Description |
|------|---------|-------------|
| `create_log_entry` | — | Create logbook entry, auto-update boat_status |
| `manage_checklist` | add, check, uncheck, delete, edit, list | Full CRUD on checklist items |
| `update_boat_status` | — | Update position, fuel, water, nav_status, problems |
| `manage_route` | update_status, add_step, edit_step, delete_step, list | Full CRUD on route steps |
| `create_reminder` | — | Schedule a reminder |
| `get_weather` | — | Fetch weather forecast for coordinates |
| `update_memory` | — | Update persistent AI memory (situation, boat, crew, preferences) |

### AI Memory System

Persistent memory across sessions, stored in `ai_memory` table (4 slugs):
- `situation` — Current voyage situation, recent events
- `boat` — Boat state, known issues, equipment notes
- `crew` — Crew info, preferences, habits
- `preferences` — Communication style, recurring requests

Memory is injected into both briefing and chat system prompts. Updated via `update_memory` tool during chat and via `/api/ai/memory-extract` cron endpoint.

### Models
- **Claude Haiku 4.5** (`claude-haiku-4-5`) — Chat (fast, cheap, agentic with tools)
- **Claude Sonnet 4.5** (`claude-sonnet-4-5`) — Briefings, route proposals, complex analysis

### AI Route Proposals (`/api/ai/route`)
Used during onboarding (step 3) and when creating/editing a voyage in Settings:
1. Receive departure port, arrival port, boat specs, navigator profile
2. Call Claude Sonnet to generate 2-3 route options (or 1 custom route if "Other" + free text)
3. Each option: name, summary, distances, estimated days, pros/cons, warnings, detailed steps with coordinates
4. Response is structured JSON — the frontend renders cards for selection + map preview
5. Selected route → `route_steps` insert + `boat_status` initialization

### System Prompt Personality
The AI adapts to the user's nav_profile. For experienced solo navigators: direct, skipper-to-skipper, no beginner hand-holding, frank recommendations, nautical terminology. For beginners: more explanatory and reassuring.

### 5 MVP Triggers
Evaluated by cron every 4h (6am-10pm) **for all users with active voyages**:
1. **Weather change** — Wind forecast changes > 10 kn vs morning briefing
2. **Log reminder** — No log in 12h
3. **Departure watch** — Tomorrow's briefing = GO
4. **Critical checklist** — Critical item unchecked + departure < 3 days
5. **Low fuel** — Fuel < 25%

## Key Conventions

### Code Style
- TypeScript strict mode
- Functional components with hooks
- Server Components by default, `'use client'` only when needed
- Tailwind for all styling (no CSS modules)
- Named exports for components
- `camelCase` for variables/functions, `PascalCase` for components/types

### API Routes
- Use Next.js Route Handlers (`route.ts`)
- Return `NextResponse.json()` with proper status codes
- All AI routes stream responses using `ReadableStream`
- **All authenticated routes must extract user from Supabase session**
- **All queries must be scoped by user_id (and voyage_id where relevant)**
- Error handling with try/catch, return meaningful error messages

### Supabase
- Use `@supabase/ssr` for server-side client
- Use `@supabase/supabase-js` for browser client
- Generate types with `supabase gen types typescript`
- **RLS policies on ALL tables** — each user sees only their own data
- Auth with magic link email provider

### UI/UX
- Mobile-first: design for 360px width
- Touch targets ≥ 44x44px
- Verdict colors: GO=#22C55E, STANDBY=#F59E0B, NO-GO=#EF4444
- Bottom tab bar: **Accueil** (Dashboard), **Route**, **Journal** (Log), **Chat**, **Plus** (More)
- Dark mode support: Tailwind `dark:` classes + `ThemeProvider` (dark/light/system toggle, persisted to localStorage)
- Map dark mode: CartoDB Dark Matter base tiles, OpenSeaMap overlay preserved
- French language for all user-facing text (Sébastien's preference)
- Briefings rendered as markdown (react-markdown) with custom `.prose-briefing` CSS
- **Active voyage context** — most screens are scoped to the user's active voyage

### Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic AI (server-side only — NOT per-user)
ANTHROPIC_API_KEY=

# WorldTides
WORLDTIDES_API_KEY=

# Web Push (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

# Vercel Cron Secret
CRON_SECRET=
```

## Sébastien's Boat: Laurine (example config)

These are Sébastien's settings — other users configure their own boat during onboarding:

- Laurin Koster 28, ~8.5m, draft 1.45m, air draft 12m
- Diesel engine, ~40h total fuel (tank + jerricans)
- Average speed ~4.5 kn
- No AIS transmitter (receiver only)
- Unreliable autopilot
- Navigation lights being repaired

## Sébastien's Route: Audierne → Nice (example voyage)

20 legs, 5 phases: Atlantic → Gironde → Garonne Canal → Midi Canal → Mediterranean
~520 NM maritime + ~420 km canals

Critical passages: Raz de Sein, Gironde estuary, Gulf of Lion

## What NOT to do

- Don't implement BYOAI (per-user API keys) — that's V1.5. MVP uses server-side key.
- Don't implement billing/Stripe — that's V1.5. MVP is free during beta.
- Don't build a custom ML model — all intelligence is in the prompt
- Don't over-engineer triggers — simple if/then rules, not a complex event system
- Don't use Google Maps/Mapbox — use Leaflet + OSM (free, offline-capable)
- Don't build native apps — PWA only
- Don't forget offline — everything must work with cached data when no network
- Don't forget user scoping — EVERY query must filter by user_id
- Don't hardcode boat specs or route — everything comes from the database via onboarding


<claude-mem-context>

</claude-mem-context>