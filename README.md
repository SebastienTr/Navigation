# Laurine Navigator

AI-powered sailing first mate — a multi-user PWA that helps sailors make daily go/no-go decisions and navigate safely.

Built initially for Sébastien's convoy from Audierne (Finistère) to Nice, designed for any sailor from day 1.

## Status

**MVP feature-complete** (~20,000 lines). All core features implemented and tested.

| Feature | Status |
|---------|--------|
| Auth (magic link) | Done |
| Onboarding (4 steps + AI route) | Done |
| Dashboard (verdict, weather, levels) | Done |
| Map (Leaflet + OpenSeaMap) | Done |
| Logbook (entry + history) | Done |
| AI Chat (streaming, markdown) | Done |
| Briefings (cron + history) | Done |
| Checklist (categories, priorities) | Done |
| Route progress | Done |
| Settings (boat, profile, voyages) | Done |
| AI proxy (server-side Claude) | Done |
| Trigger engine (5 rules) | Done |
| Weather/Tides APIs | Done |
| PWA (manifest, Service Worker) | Done |

## Tech Stack

- **Frontend**: Next.js 15 + React 19 + TypeScript + Tailwind CSS 4
- **Map**: Leaflet + react-leaflet + OpenSeaMap
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **AI**: Claude API (Haiku for chat, Sonnet for briefings/routes)
- **Weather**: Open-Meteo (free) + WorldTides
- **Hosting**: Vercel

## Getting Started

```bash
# Install dependencies
npm install

# Copy env vars
cp .env.local.example .env.local
# Fill in Supabase, Anthropic, WorldTides keys

# Run Supabase migration
# (apply supabase/migrations/001_initial.sql to your project)

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
  app/
    layout.tsx              # Root layout (PWA meta)
    login/page.tsx          # Magic link auth
    onboarding/page.tsx     # 4-step wizard + AI routes
    auth/callback/route.ts  # Auth callback
    (app)/                  # Protected route group
      layout.tsx            # App shell (BottomNav, auth guard)
      page.tsx              # Dashboard
      map/                  # Leaflet map + OpenSeaMap
      log/page.tsx          # Logbook
      chat/page.tsx         # AI chat
      briefings/page.tsx    # Briefing history
      checklist/page.tsx    # Task checklist
      route/page.tsx        # Route progress
      settings/page.tsx     # Boat/profile/voyage management
      more/page.tsx         # Menu (links to sub-pages)
    api/
      ai/proxy/route.ts    # Claude API proxy (streaming)
      ai/route/route.ts    # AI route proposals
      ai/triggers/route.ts # Trigger evaluation (cron)
      briefing/route.ts    # Daily briefing (cron)
      chat/route.ts        # Chat endpoint
      weather/route.ts     # Open-Meteo proxy
      tides/route.ts       # WorldTides proxy
  lib/
    supabase/              # Clients, types, queries
    auth/                  # AuthContext, useAuth, useUser
    ai/                    # Proxy, prompts, context, routes
    weather/               # Open-Meteo + WorldTides clients
    triggers/              # Engine + 5 MVP rules
  components/
    layout/BottomNav.tsx   # Bottom tab navigation
    ui/                    # Card, LoadingSpinner
  hooks/                   # useGeolocation, useServiceWorker
  types/                   # Shared TypeScript types
```

## Documentation

- [PRD.md](./PRD.md) — MVP specification
- [BUILD_PLAN.md](./BUILD_PLAN.md) — Build steps with progress
- [VISION.md](./VISION.md) — Long-term product vision
- [CLAUDE.md](./CLAUDE.md) — AI coding assistant context

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
WORLDTIDES_API_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
CRON_SECRET=
```
