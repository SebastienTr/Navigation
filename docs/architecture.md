# Bosco — Architecture

**Generated:** 2026-02-28 | **Scan Level:** Exhaustive

## Architecture Type

**Component-based Full-stack Monolith** — React client pages with Next.js API routes, PostgreSQL via Supabase, server-side AI proxy.

No separate client/server repos. No microservices. No BFF layer. The Next.js App Router serves both the React UI and the API endpoints from the same deployment.

## High-Level Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                        VERCEL                                 │
│                                                               │
│  ┌──────────────────────────────────┐                        │
│  │        Next.js 16 App            │                        │
│  │                                  │                        │
│  │  ┌────────────┐ ┌────────────┐  │                        │
│  │  │ React Pages│ │ API Routes │  │                        │
│  │  │  (Client)  │ │  (Server)  │  │                        │
│  │  └──────┬─────┘ └─────┬──────┘  │                        │
│  │         │              │         │                        │
│  └─────────┼──────────────┼─────────┘                        │
│            │              │                                   │
│  ┌─────────┼──────────────┼─────────┐                        │
│  │  Vercel Cron Jobs                │                        │
│  │  • briefing (4am UTC daily)      │                        │
│  │  • triggers  (5am UTC daily)     │                        │
│  └──────────────────────────────────┘                        │
└──────────┬───────────────┬───────────────────────────────────┘
           │               │
     ┌─────▼─────┐   ┌────▼─────┐   ┌───────────┐   ┌───────────┐
     │ Supabase  │   │  Claude  │   │ Open-Meteo │   │WorldTides │
     │ (Postgres │   │  API     │   │   (free)   │   │  API v3   │
     │  + Auth)  │   │(Anthropic│   └───────────┘   └───────────┘
     └───────────┘   └──────────┘
```

## Technology Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| **Runtime** | Node.js | ≥18 | Vercel serverless |
| **Framework** | Next.js | 16.1.6 | App Router |
| **UI** | React | 19.2.3 | Client Components + Server Components |
| **Language** | TypeScript | ^5 | Strict mode |
| **Styling** | Tailwind CSS | ^4 | PostCSS plugin, no CSS modules |
| **Maps** | Leaflet + react-leaflet | 1.9.4 / 5.0.0 | OpenSeaMap overlay |
| **Database** | Supabase (PostgreSQL) | SDK 2.98.0 | + Auth + RLS + Storage |
| **Auth** | Supabase Auth | via @supabase/ssr 0.8.0 | Magic link (email OTP) |
| **AI** | Anthropic Claude API | SDK 0.78.0 | Haiku 4.5 + Sonnet 4.6 |
| **Weather** | Open-Meteo | REST API | Free, no key |
| **Tides** | WorldTides | API v3 | Paid key |
| **Push** | web-push | 3.6.7 | VAPID protocol |
| **Markdown** | react-markdown + rehype | 10.1.0 | Briefing rendering |
| **Date/Time** | date-fns | 4.1.0 | Formatting |
| **Hosting** | Vercel | Hobby plan | Free tier |

## Rendering Strategy

| Page | Strategy | Why |
|------|----------|-----|
| `/login` | Client Component | Form interactions, Supabase Auth |
| `/onboarding` | Client Component | Multi-step wizard, AI streaming |
| `/(app)/*` | Client Components | Real-time data, interactive UI |
| `/api/*` | Server (Route Handlers) | Auth, DB access, AI proxy |
| Root `layout.tsx` | Server Component | Static shell, PWA meta |

All page components under `(app)/` are `'use client'` — the app is heavily interactive with real-time data fetching and state management. No server-side rendering for data pages.

## Authentication Flow

```
User enters email
    │
    ▼
signInWithOtp() ──► Supabase Auth ──► Magic link email
    │
    ▼
User clicks link
    │
    ▼
/auth/callback ──► Exchange code for session ──► Set cookies
    │
    ▼
middleware.ts checks every request:
    ├── No session? ──► Redirect to /login
    ├── Not onboarded? ──► Redirect to /onboarding
    └── Valid? ──► Allow request
```

## Data Architecture

### Client-Server Data Flow

Pages fetch data directly from Supabase using the browser client (`@supabase/supabase-js`). RLS policies ensure users only see their own data.

AI operations go through API routes:
- Chat → `POST /api/chat` (SSE streaming)
- Briefings → `POST /api/briefing` or `GET` (cron)
- Weather → `GET /api/weather` (cached proxy)
- Tides → `GET /api/tides` (cached proxy)

### Supabase Client Variants

| Client | File | Context | RLS |
|--------|------|---------|-----|
| Browser | `client.ts` | React components | Yes — `auth.uid()` |
| Server | `server.ts` | API routes (user context) | Yes — via cookies |
| Admin | `admin.ts` | Tool handlers, cron jobs | No — service role bypasses RLS |

### Query Layer

29 typed query helpers in `queries.ts` — all return typed rows using `.returns<T[]>()`. Common patterns:
- Scoped by `user_id` or `voyage_id`
- Ordered by `created_at DESC` or `order_num ASC`
- Optional `limit` parameter
- Error thrown on failure (caller handles)

## State Management

No Redux, no Zustand, no external state library. State lives in:

1. **React component state** (`useState`, `useEffect`) — page-level data
2. **AuthContext** (`useAuth()`) — session, user, loading state
3. **URL** — active page via Next.js router
4. **Supabase** — source of truth for all persistent data
5. **localStorage** — theme preference only

### Active Voyage Pattern

Most screens are scoped to the user's "active voyage" (status = 'active'). The `useActiveVoyage()` hook fetches it from Supabase and provides it to all child components.

## Offline Architecture

### Service Worker (`public/sw.js`)

- **Cache-first** for static assets (shell, icons, tiles)
- **Network-first** for API calls
- **Push notification handler** — displays notifications when app is in background

### IndexedDB Queue (`offline-queue.ts`)

- Log entries queued locally when offline
- Synced to Supabase when connection returns
- Queue stored in IndexedDB (not localStorage — no size limits)

### Map Tiles

Leaflet caches viewed tiles in the browser's HTTP cache. No custom tile caching — relies on browser defaults + Service Worker cache-first strategy.

## API Design Patterns

### Authentication

All API routes verify the Supabase session:
```
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return 401
```

### Streaming (SSE)

Chat and proxy endpoints return `ReadableStream<Uint8Array>` with SSE format:
```
data: {"type":"text_delta","text":"Hello"}\n\n
data: {"type":"message_stop","usage":{...}}\n\n
```

### Cron Jobs

Protected by `CRON_SECRET` in Bearer token. Time-windowed (6am-10pm Paris time for triggers).

### Caching

- Weather: 1h cache (`revalidate: 3600`)
- Tides: 6h cache (`revalidate: 21600`)
- No caching for AI endpoints

## Theme System

Three modes: `light`, `dark`, `system`. Managed by `ThemeProvider`:
- Persisted to `localStorage`
- Applied via `<html class="dark">` for Tailwind's `dark:` variant
- Script in `<head>` prevents flash of wrong theme
- Map tiles switch between OSM/CartoDB Dark Matter based on theme

## PWA Configuration

- `manifest.json` — French language, standalone display, shortcuts
- Custom Service Worker (not workbox) — push notifications, cache strategies
- Viewport: `viewport-fit=cover` for safe area on iOS
- Touch targets: ≥ 44px throughout
- Bottom tab navigation: 5 tabs (Accueil, Route, Journal, Chat, Plus)

## Deployment

- **Platform:** Vercel (Hobby plan)
- **Build:** `next build` via Vercel CI
- **Environment:** 7 env vars (Supabase, Anthropic, WorldTides, VAPID, CRON_SECRET)
- **Cron:** 2 jobs defined in `vercel.json`:
  - Briefing: `0 4 * * *` (4am UTC = 5am Paris winter / 6am summer)
  - Triggers: `0 5 * * *` (5am UTC)
- **Database:** Auto-migration at server startup via `instrumentation.ts`

## Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Monolith vs microservices | Monolith | Solo dev, <20k LOC, same deployment unit |
| Client vs server rendering | Client-heavy | Interactive UI, real-time data |
| State management | Component state + Supabase | No complex client-side state needed |
| AI architecture | Prompt engineering + tool_use | Simple, no ML infrastructure |
| Map library | Leaflet + OSM | Free, offline-capable, maritime overlays |
| Auth method | Magic link (email) | No passwords to manage, mobile-friendly |
| Database | Supabase (PostgreSQL) | RLS, Auth, Realtime, free tier |
| Styling | Tailwind CSS 4 | Rapid prototyping, dark mode built-in |
| Offline | Service Worker + IndexedDB | PWA requirement, no native app |
