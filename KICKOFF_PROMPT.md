# Kickoff Prompt for Claude Code

Copy-paste this entire prompt into Claude Code to build the full project.

---

Build the complete Laurine Navigator app from scratch. This is an AI-powered sailing first mate — a multi-user PWA built with Next.js 15 + Supabase + Claude API.

## Context files (READ THESE FIRST)

Before writing ANY code, read these files in order:
1. `CLAUDE.md` — Project context, architecture, conventions, structure
2. `PRD.md` — Full product spec (sections 6-8 are critical: features, AI system, database schema)
3. `BUILD_PLAN.md` — Sequenced build steps (follow this order)
4. `supabase/migrations/001_initial.sql` — Database schema with RLS policies
5. `.env.local.example` — Required environment variables

## What to build

The ENTIRE MVP as described in BUILD_PLAN.md, phases 1 through 6. Every page, every API route, every component. Nothing skipped.

## Key architecture decisions (non-negotiable)

- **Multi-user from day 1**: Supabase Auth with magic link email. RLS on all tables. Every query scoped by user_id and voyage_id.
- **Server-side AI only**: Single `ANTHROPIC_API_KEY` in env vars. No per-user API keys. No ai_config table.
- **AI route proposals**: Onboarding step 3 calls `/api/ai/route` → Claude Sonnet generates 2-3 route options → user picks one or describes custom route via "Other" → route_steps are created per-voyage.
- **4-step onboarding wizard**: My Boat → My Profile → My Voyage (with AI route proposals) → Done. Shown when `onboarding_completed = false`. Reusable route wizard in Settings.
- **Mobile-first PWA**: Designed for 360px width, one-handed cockpit use. Touch targets ≥ 44px. Bottom tab navigation.
- **French language**: All user-facing text in French.
- **Offline-first**: Service Worker caches briefings, map tiles, last known state. Log entries queue locally.

## Build order (follow BUILD_PLAN.md strictly)

### Phase 1: Setup & Auth
- Scaffold Next.js 15 project with TypeScript + Tailwind CSS 4
- Install all dependencies (see BUILD_PLAN.md step 1.1)
- Set up Supabase clients (browser + server using @supabase/ssr)
- Run the migration from `supabase/migrations/001_initial.sql`
- Auth middleware: protected routes, redirect to /login or /onboarding
- PWA manifest + basic Service Worker

### Phase 1.5: Auth & Onboarding
- Login page with magic link
- 4-step onboarding wizard (the route step is complex — see PRD.md section 6.0)
- Auth context + hooks (useAuth, useUser)

### Phase 2: Backend Core
- `/api/ai/route` — AI route generation (2-3 proposals or custom, structured JSON response)
- `/api/weather` — Open-Meteo marine weather proxy
- `/api/tides` — WorldTides proxy
- `/api/ai/proxy` — Server-side Claude proxy with streaming
- Context builder (`src/lib/ai/context.ts`) — gathers all user/voyage data for prompts
- System prompts (`src/lib/ai/prompts.ts`) — briefing, chat, triggers, route

### Phase 3: Frontend Core
- Dashboard with verdict card, weather summary, fuel/water levels, route progress, mini-map
- Full-screen Leaflet map with OpenSeaMap overlay, route polyline, boat marker
- Logbook (entry form + history)
- Route progress view
- Checklist with categories and priorities
- Bottom tab navigation (Dashboard, Map, Log, Chat, More)

### Phase 4: AI Features
- Daily briefing system (`/api/briefing` + briefings page)
- AI chat with streaming (`/api/chat` + chat page)
- 5 trigger rules + trigger engine (`/api/ai/triggers`)
- Vercel cron configuration (vercel.json)

### Phase 5: Settings & Polish
- Settings page (edit boat, profile, voyages — create new voyage triggers route wizard)
- Web Push notifications
- Offline support (enhanced Service Worker, IndexedDB log queue)
- UI polish (loading skeletons, error states, empty states, transitions)

### Phase 6: Test & Deploy
- Create test data in Supabase
- Run through the full manual testing checklist (see BUILD_PLAN.md step 6.2)
- Verify multi-user data isolation
- Verify AI route proposals work for different departure/arrival combos
- Lighthouse PWA audit
- Deploy to Vercel

## Quality standards

- TypeScript strict mode, zero `any` types
- All components are Server Components by default, `'use client'` only when needed
- Tailwind for ALL styling, no CSS modules
- Every API route has proper error handling with try/catch and meaningful error messages
- Every database query is scoped by user_id (and voyage_id where applicable)
- All AI responses are streamed
- Dark mode support with Tailwind `dark:` classes
- Accessible: proper aria labels, semantic HTML

## AI system details

Models:
- Claude Haiku 4.5 (`claude-haiku-4-5`) for chat
- Claude Sonnet 4.5 (`claude-sonnet-4-5`) for briefings, route proposals, complex analysis

The AI adapts its personality based on nav_profile:
- Experienced solo navigator → direct, skipper-to-skipper, nautical terminology, frank recommendations
- Beginner → more explanatory, reassuring, educational

Route generation prompt must consider:
- Boat draft (port accessibility), air draft (canal bridges), fuel range, average speed
- Navigator experience, crew mode, risk tolerance
- Multiple possible routes between any two ports (coastal vs offshore vs canal)
- Structured JSON output with coordinates for each waypoint

## Don't forget

- The `phase` CHECK constraint on route_steps is flexible — AI can generate routes with phases beyond the 5 predefined ones
- Verdict colors: GO=#22C55E, STANDBY=#F59E0B, NO-GO=#EF4444
- The onboarding route wizard is REUSED in Settings when creating a new voyage
- Cron jobs must iterate over ALL users with active voyages, not assume single user
- Briefing at 5am French time, triggers every 4h (6am-10pm French time)
- The `handle_new_user()` trigger in SQL auto-creates a user profile on Supabase Auth signup

Go. Build everything. Test everything. Ship it.
