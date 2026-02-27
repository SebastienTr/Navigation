# Laurine Navigator — Claude Code Project Context

## What is this project?

**Laurine Navigator** is an AI-powered sailing first mate — a multi-user PWA that helps sailors make daily go/no-go decisions and navigate safely. Built initially for Sébastien's solo convoy from Audierne (Finistère, France) to Nice, but designed for any sailor from day 1.

It's NOT just a dashboard. It's a **proactive copilot** that monitors, anticipates, and talks to the captain when something needs attention.

## Key Documents

- **[PRD.md](./PRD.md)** — MVP specification
- **[VISION.md](./VISION.md)** — Long-term product vision (Skipper AI, BYOAI, freemium)
- **[BUILD_PLAN.md](./BUILD_PLAN.md)** — Sequenced build steps with progress markers

**Always read PRD.md before starting any feature work.** It contains the complete spec, DB schema, API details, and UX requirements.

## Implementation Status (updated 2026-02-27)

**MVP is feature-complete** (~20,000 lines of code). All pages, API routes, AI system, and database are implemented and tested.

| Area | Status | Lines |
|------|--------|-------|
| Auth (magic link + middleware) | Done | ~230 |
| Onboarding (4-step wizard + AI routes) | Done | ~1,323 |
| Dashboard | Done | ~556 |
| Map (Leaflet + OpenSeaMap) | Done | ~375 |
| Logbook (entry + GPS + history) | Done | ~627 |
| AI Chat (streaming + markdown) | Done | ~399 |
| Briefings (generation + history) | Done | ~489 |
| Checklist (categories + priorities) | Done | ~615 |
| Route progress | Done | ~437 |
| Settings (boat + profile + voyages) | Done | ~1,232 |
| More menu | Done | ~78 |
| API routes (7 endpoints) | Done | ~1,203 |
| AI system (proxy + context + prompts) | Done | ~1,140 |
| Trigger engine (5 rules) | Done | ~448 |
| Weather + Tides clients | Done | ~302 |
| Supabase (types + queries + clients) | Done | ~918 |
| PWA (manifest + Service Worker) | Done | ~136 |
| DB schema (migration + seed) | Done | ~368 |

**Not yet done (planned for polish/deploy):**
- Push notification integration (Web Push registered but not wired to triggers)
- Advanced offline sync (Service Worker caches shell, but IndexedDB log queue not implemented)
- Vercel production deployment
- Lighthouse PWA audit

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS 4 |
| Map | Leaflet + react-leaflet + OpenSeaMap overlay |
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
├── middleware.ts                    # Auth guard (redirect unauthenticated)
├── app/
│   ├── layout.tsx                  # Root layout (PWA meta, viewport-fit cover)
│   ├── globals.css                 # Tailwind base styles
│   ├── login/page.tsx              # Magic link login
│   ├── onboarding/page.tsx         # 4-step onboarding wizard (1,323 lines)
│   ├── auth/callback/route.ts      # Supabase Auth callback
│   ├── (app)/                      # Protected route group
│   │   ├── layout.tsx              # App shell (auth check, BottomNav, safe area)
│   │   ├── page.tsx                # Dashboard
│   │   ├── map/page.tsx            # Map page (loads MapView)
│   │   ├── map/MapView.tsx         # Leaflet + OpenSeaMap component
│   │   ├── log/page.tsx            # Logbook (entry + history)
│   │   ├── chat/page.tsx           # AI Chat (streaming + markdown)
│   │   ├── briefings/page.tsx      # Briefing history
│   │   ├── checklist/page.tsx      # Checklist (categories + priorities)
│   │   ├── route/page.tsx          # Route progress
│   │   ├── settings/page.tsx       # Boat/profile/voyage management (1,232 lines)
│   │   └── more/page.tsx           # More menu
│   └── api/
│       ├── ai/proxy/route.ts       # Claude API proxy (streaming)
│       ├── ai/route/route.ts       # AI route proposals (Claude Sonnet)
│       ├── ai/triggers/route.ts    # Trigger evaluation (cron)
│       ├── briefing/route.ts       # Daily briefing generation (cron)
│       ├── chat/route.ts           # Chat endpoint (streaming)
│       ├── weather/route.ts        # Open-Meteo proxy
│       └── tides/route.ts          # WorldTides proxy
├── components/
│   ├── Providers.tsx               # React context providers (Auth)
│   ├── layout/BottomNav.tsx        # Bottom tab bar (5 tabs)
│   └── ui/
│       ├── Card.tsx                # Reusable card component
│       └── LoadingSpinner.tsx      # Loading indicator
├── lib/
│   ├── supabase/
│   │   ├── client.ts              # Browser Supabase client
│   │   ├── server.ts              # Server Supabase client (SSR)
│   │   ├── admin.ts               # Admin client (service role)
│   │   ├── types.ts               # Generated DB types (579 lines)
│   │   └── queries.ts             # User-scoped query helpers (273 lines)
│   ├── auth/
│   │   ├── context.tsx            # AuthContext provider
│   │   └── hooks.ts               # useAuth() + useUser()
│   ├── ai/
│   │   ├── proxy.ts               # Server-side Claude proxy
│   │   ├── prompts.ts             # System prompts (461 lines)
│   │   ├── context.ts             # Context builder (289 lines)
│   │   └── route.ts               # Route proposal logic
│   ├── weather/
│   │   ├── open-meteo.ts          # Open-Meteo client
│   │   └── worldtides.ts          # WorldTides client
│   ├── triggers/
│   │   ├── engine.ts              # Trigger evaluation engine
│   │   └── rules.ts               # 5 MVP trigger rules
│   ├── utils.ts                   # Format dates, distances, coordinates
│   └── push.ts                    # Web Push subscription
├── hooks/
│   ├── useGeolocation.ts          # Browser GPS
│   └── useServiceWorker.ts        # SW registration
└── types/
    └── index.ts                   # Shared TypeScript types
public/
├── manifest.json                  # PWA manifest
├── sw.js                          # Service Worker
└── icons/                         # PWA icons (192, 512, SVG + PNG)
supabase/
└── migrations/
    └── 001_initial.sql            # Full schema with RLS (252 lines)
```

**Note**: Most page logic is inline (not split into separate components). The `components/` directory is intentionally minimal — refactoring into shared components is planned as the app grows.

## Database

Full schema is in PRD.md section 8. Key tables:

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

### Server-side AI Proxy (`/api/ai/proxy`)

Every AI call goes through this proxy:
1. Read `ANTHROPIC_API_KEY` from `process.env`
2. Get user's boat/voyage context from Supabase (scoped by user_id)
3. Call `context.ts` → gathers position, weather, boat status, route, logs, problems
4. Build system prompt from `prompts.ts` + context
5. Call Claude API (Anthropic SDK) with streaming
6. Return streamed response

**No per-user API keys in MVP.** Single server-side key, free during beta.

### Models
- **Claude Haiku 4.5** (`claude-haiku-4-5`) — Chat (fast, cheap)
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
- Bottom tab bar: Dashboard, Map, Log, Chat, More
- Dark mode support (Tailwind `dark:` classes)
- French language for all user-facing text (Sébastien's preference)
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