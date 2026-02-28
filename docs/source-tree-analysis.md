# Bosco — Source Tree Analysis

**Generated:** 2026-02-28 | **Scan Level:** Exhaustive

## Complete Annotated Directory Tree

```
navigation/                          # Project root
├── src/                             # All source code
│   ├── middleware.ts                 # Auth guard — redirects unauthenticated → /login, not onboarded → /onboarding (100 lines)
│   ├── instrumentation.ts           # Auto-run DB migrations at server startup (6 lines)
│   │
│   ├── app/                         # Next.js App Router pages
│   │   ├── layout.tsx               # Root layout — PWA meta, viewport, theme script, Providers (49 lines)
│   │   ├── globals.css              # Tailwind base + .prose-briefing + .prose-chat + dark mode (256 lines)
│   │   │
│   │   ├── login/
│   │   │   └── page.tsx             # Magic link auth — email → signInWithOtp → "Check email" (140 lines) [CLIENT]
│   │   │
│   │   ├── onboarding/
│   │   │   └── page.tsx             # 4-step wizard: Boat → Profile → Voyage (AI routes) → Done (1,040 lines) [CLIENT]
│   │   │
│   │   ├── auth/callback/
│   │   │   └── route.ts             # Supabase Auth callback — code → session → redirect (27 lines)
│   │   │
│   │   ├── (app)/                   # Protected route group (requires auth)
│   │   │   ├── layout.tsx           # App shell — auth check, BottomNav, safe area (33 lines) [CLIENT]
│   │   │   ├── page.tsx             # DASHBOARD — verdict, weather, levels, route, map, mate messages (973 lines) [CLIENT]
│   │   │   │
│   │   │   ├── briefings/
│   │   │   │   └── page.tsx         # Briefing history — markdown render, verdict filter, delete (566 lines) [CLIENT]
│   │   │   ├── chat/
│   │   │   │   └── page.tsx         # AI Chat — SSE streaming, tool badges, suggestions (587 lines) [CLIENT]
│   │   │   ├── checklist/
│   │   │   │   └── page.tsx         # Task management — 6 categories, 4 priorities, CRUD (615 lines) [CLIENT]
│   │   │   ├── log/
│   │   │   │   └── page.tsx         # Logbook — entry form, GPS, photos, offline queue (1,018 lines) [CLIENT]
│   │   │   ├── map/
│   │   │   │   ├── page.tsx         # Full-screen map wrapper + GPS center button (137 lines) [CLIENT]
│   │   │   │   └── MapView.tsx      # Leaflet renderer — route polylines, dark tiles, OpenSeaMap (246 lines) [CLIENT]
│   │   │   ├── more/
│   │   │   │   └── page.tsx         # Menu — theme picker, nav links, sign out (116 lines) [CLIENT]
│   │   │   ├── reminders/
│   │   │   │   └── page.tsx         # Reminders — pending/past, dismiss, delete (315 lines) [CLIENT]
│   │   │   ├── route/
│   │   │   │   └── page.tsx         # Route editor — phase groups, status toggle, CRUD steps (967 lines) [CLIENT]
│   │   │   └── settings/
│   │   │       └── page.tsx         # Settings — boat, profile, voyages, push, sign out (1,517 lines) [CLIENT]
│   │   │
│   │   └── api/                     # API Route Handlers (server-side)
│   │       ├── ai/
│   │       │   ├── proxy/route.ts   # Claude API proxy — SSE streaming (86 lines)
│   │       │   ├── route/route.ts   # AI route proposals — 2-3 options via Sonnet (300 lines)
│   │       │   ├── triggers/route.ts # Cron: evaluate 5 triggers for all voyages (169 lines)
│   │       │   └── memory-extract/route.ts # Cron: extract AI memory from chat (300 lines)
│   │       ├── briefing/route.ts    # Daily briefing generation — cron GET + manual POST (332 lines)
│   │       ├── chat/route.ts        # Agentic chat — tool_use, 5 turns, SSE (226 lines)
│   │       ├── push/route.ts        # Push subscription — subscribe/unsubscribe (100 lines)
│   │       ├── weather/route.ts     # Open-Meteo proxy — cached 1h (52 lines)
│   │       └── tides/route.ts       # WorldTides proxy — cached 6h (69 lines)
│   │
│   ├── components/                  # Shared React components
│   │   ├── Providers.tsx            # Root provider composition: AuthProvider + ThemeProvider (12 lines)
│   │   ├── layout/
│   │   │   └── BottomNav.tsx        # 5-tab bottom bar: Accueil, Route, Journal, Chat, Plus (64 lines)
│   │   ├── map/
│   │   │   └── MiniMapView.tsx      # Non-interactive mini map for dashboard (104 lines)
│   │   ├── ui/
│   │   │   ├── Card.tsx             # Reusable card — auto-detects custom bg (39 lines)
│   │   │   ├── LoadingSpinner.tsx   # Animated spinner with optional text (25 lines)
│   │   │   └── Skeleton.tsx         # Pulse placeholder for loading states (7 lines)
│   │   └── voyage/
│   │       ├── AIRouteWizard.tsx    # AI route generation wizard — streaming, map preview (690 lines) [CLIENT]
│   │       └── RoutePreviewMap.tsx  # Route map with waypoints, colors, fit bounds (237 lines) [CLIENT]
│   │
│   ├── lib/                         # Core business logic (no React)
│   │   ├── ai/
│   │   │   ├── context.ts           # Context builders — gathers all voyage data for AI (324 lines)
│   │   │   ├── prompts.ts           # System prompts — briefing, chat, trigger, route (578 lines)
│   │   │   ├── proxy.ts             # Anthropic SDK wrapper — streaming + agentic loop (276 lines)
│   │   │   ├── route.ts             # Route proposal generator — JSON parse + validation (271 lines)
│   │   │   ├── tools.ts             # 7 AI tool definitions (Anthropic tool_use format) (290 lines)
│   │   │   └── tool-handlers.ts     # Tool execution — log, checklist, route, reminder, weather, memory (743 lines)
│   │   ├── auth/
│   │   │   ├── context.tsx          # AuthProvider + useAuth hook (82 lines)
│   │   │   └── hooks.ts             # useUser, useActiveVoyage hooks (181 lines)
│   │   ├── db/
│   │   │   └── migrate.ts           # Auto-migration runner — reads SQL, tracks applied (71 lines)
│   │   ├── supabase/
│   │   │   ├── client.ts            # Browser Supabase client (9 lines)
│   │   │   ├── server.ts            # Server Supabase client with cookies (30 lines)
│   │   │   ├── admin.ts             # Service role client (bypasses RLS) (27 lines)
│   │   │   ├── queries.ts           # 29 user-scoped query helpers (327 lines)
│   │   │   ├── storage.ts           # Photo upload to Supabase Storage (37 lines)
│   │   │   └── types.ts             # Auto-generated TypeScript DB types (722 lines)
│   │   ├── triggers/
│   │   │   ├── engine.ts            # Trigger evaluation — context + rules + Claude message (213 lines)
│   │   │   └── rules.ts             # 5 trigger rules: weather, log, departure, checklist, fuel (256 lines)
│   │   ├── weather/
│   │   │   ├── open-meteo.ts        # Open-Meteo client — marine, forecast, AROME, ECMWF (328 lines)
│   │   │   ├── summary.ts           # Weather summary formatting
│   │   │   └── worldtides.ts        # WorldTides API v3 client (147 lines)
│   │   ├── theme.tsx                # ThemeProvider — dark/light/system toggle (84 lines)
│   │   ├── offline-queue.ts         # IndexedDB queue for offline log entries (71 lines)
│   │   ├── push.ts                  # Web Push sender — VAPID, delivery, cleanup (84 lines)
│   │   └── utils.ts                 # Formatting: dates, distances, verdicts, fuel levels (113 lines)
│   │
│   ├── hooks/                       # Custom React hooks
│   │   ├── useGeolocation.ts        # Browser GPS — getCurrentPosition (49 lines)
│   │   ├── usePushNotifications.ts  # Push subscribe/unsubscribe (102 lines)
│   │   ├── useOnlineStatus.ts       # Online/offline detection (24 lines)
│   │   └── useServiceWorker.ts      # SW registration (13 lines)
│   │
│   └── types/
│       └── index.ts                 # Shared TypeScript types — DB rows, enums, contexts (180 lines)
│
├── public/                          # Static assets (served as-is)
│   ├── manifest.json                # PWA manifest — French, standalone, shortcuts (60 lines)
│   ├── sw.js                        # Service Worker — cache strategies, push handler (116 lines)
│   ├── icons/                       # PWA icons (192x192, 512x512, SVG + PNG)
│   └── *.svg                        # Default Next.js SVGs
│
├── supabase/                        # Database layer
│   ├── migrations/
│   │   ├── 001_initial.sql          # Core schema: 10 tables, 14 indexes, RLS, trigger (302 lines)
│   │   ├── 002_reminders.sql        # Reminders table with categories + status (57 lines)
│   │   ├── 003_push_subscriptions.sql # Push subscription storage (37 lines)
│   │   ├── 004_photo_urls.sql       # photo_url → photo_urls[] migration (4 lines)
│   │   ├── 005_relax_phase_check.sql # Remove hardcoded phase constraint (4 lines)
│   │   └── 006_ai_memory.sql        # AI memory + versions tables (65 lines)
│   └── seed.sql                     # Dev seed template: Laurine boat + Audierne→Nice (117 lines)
│
├── scripts/
│   └── purge-db.mjs                 # Delete all data (dev utility) (84 lines)
│
├── package.json                     # 12 prod + 11 dev dependencies
├── tsconfig.json                    # ES2017, strict, @/* alias
├── next.config.ts                   # Minimal (all defaults)
├── eslint.config.mjs                # Core Web Vitals + TypeScript
├── postcss.config.mjs               # Tailwind v4 PostCSS
├── vercel.json                      # 2 cron jobs (briefing 4AM, triggers 5AM UTC)
├── dev.sh                           # Dev script (590 lines) — start, kill, reset, seed, lint
├── .env.local.example               # 7 env vars template
├── .gitignore                       # Excludes: node_modules, .next, .env*, AI dirs
│
├── PRD.md                           # MVP specification (40K chars)
├── BUILD_PLAN.md                    # Build roadmap with progress tracking
├── VISION.md                        # Long-term "Skipper AI" vision (33K chars)
├── CLAUDE.md                        # AI assistant project context
├── KICKOFF_PROMPT.md                # Initial project kickoff prompt
└── README.md                        # Getting started guide
```

## Critical Folders

| Folder | Purpose | Key Files |
|--------|---------|-----------|
| `src/lib/ai/` | AI brain — prompts, tools, proxy, context | 6 files, 2,481 lines |
| `src/lib/supabase/` | Database layer — clients, queries, types | 6 files, 1,152 lines |
| `src/app/(app)/` | Protected pages — all main views | 12 files, ~8,400 lines |
| `src/app/api/` | Server endpoints — AI, weather, push | 9 files, 1,634 lines |
| `src/lib/triggers/` | Proactive monitoring — 5 rules | 2 files, 467 lines |
| `src/components/voyage/` | Shared voyage UI — route wizard, map | 2 files, 927 lines |
| `supabase/migrations/` | DB schema evolution | 6 files, 469 lines |

## Entry Points

| Entry | File | Purpose |
|-------|------|---------|
| App root | `src/app/layout.tsx` | Root layout, PWA meta, providers |
| Auth guard | `src/middleware.ts` | Redirect unauthenticated users |
| DB setup | `src/instrumentation.ts` | Auto-run migrations on startup |
| Service Worker | `public/sw.js` | Offline cache, push notifications |
| Dev server | `dev.sh` | Development workflow script |
