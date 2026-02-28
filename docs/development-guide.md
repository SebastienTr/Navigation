# Bosco — Development Guide

**Generated:** 2026-02-28 | **Scan Level:** Exhaustive

## Prerequisites

- **Node.js** ≥ 18
- **npm** (included with Node.js)
- **Supabase account** (free tier)
- **Anthropic API key** (for AI features)
- **WorldTides API key** (optional — for tide data)

## Quick Start

```bash
# Clone
git clone <repo-url> navigation
cd navigation

# Install
npm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local with your keys

# Run development server
npm run dev
```

## Environment Variables

```env
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Anthropic AI (required for AI features)
ANTHROPIC_API_KEY=sk-ant-...

# WorldTides (optional — tide data)
WORLDTIDES_API_KEY=...

# Web Push VAPID (required for push notifications)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...

# Vercel Cron (required for cron jobs in production)
CRON_SECRET=...
```

**Note:** `NEXT_PUBLIC_` prefixed variables are exposed to the browser. All others are server-only.

## Development Script (`dev.sh`)

The project includes a comprehensive dev script (590 lines) for common operations:

```bash
# Start dev server
./dev.sh start

# Kill all dev processes
./dev.sh kill

# Reset database (drop all data, re-run migrations)
./dev.sh reset

# Seed database with sample data
./dev.sh seed

# Run linting
./dev.sh lint

# Generate Supabase types
./dev.sh types
```

## NPM Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `next dev --turbopack` | Dev server with Turbopack |
| `build` | `next build` | Production build |
| `start` | `next start` | Production server |
| `lint` | `next lint` | ESLint check |

## Database

### Migrations

Migrations are in `supabase/migrations/` and run automatically at server startup via `src/instrumentation.ts`:

```
001_initial.sql         — Core schema (10 tables, 14 indexes, RLS)
002_reminders.sql       — Reminders table
003_push_subscriptions.sql — Push subscriptions
004_photo_urls.sql      — photo_url → photo_urls[] migration
005_relax_phase_check.sql — Remove hardcoded phase constraint
006_ai_memory.sql       — AI memory + versions tables
```

All migrations are **idempotent** (`IF NOT EXISTS`, `DO $$ EXCEPTION` blocks).

### Auto-Migration

The `instrumentation.ts` file runs at Next.js startup:
1. Reads all SQL files from `supabase/migrations/`
2. Tracks which migrations have been applied
3. Runs unapplied migrations in order

### Seed Data

`supabase/seed.sql` provides a dev template with sample data for Sébastien's boat "Laurine" and the Audierne → Nice voyage.

### Database Reset

```bash
# Via dev.sh
./dev.sh reset

# Manual — delete all data
node scripts/purge-db.mjs
```

### Type Generation

```bash
# Generate TypeScript types from Supabase schema
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/supabase/types.ts
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (app)/             # Protected route group
│   ├── api/               # API Route Handlers
│   ├── login/             # Auth page
│   └── onboarding/        # Onboarding wizard
├── components/            # Shared React components
├── hooks/                 # Custom React hooks
├── lib/                   # Core business logic
│   ├── ai/               # AI system (prompts, tools, proxy)
│   ├── auth/              # Auth context + hooks
│   ├── db/                # Migration runner
│   ├── supabase/          # DB clients + queries + types
│   ├── triggers/          # Trigger engine + rules
│   └── weather/           # Weather + tide clients
└── types/                 # Shared TypeScript types
```

## Code Conventions

### TypeScript

- **Strict mode** enabled in `tsconfig.json`
- Path alias: `@/*` → `src/*`
- Target: ES2017
- All Supabase queries use `.returns<T[]>()` for type safety

### React

- Server Components by default
- `'use client'` directive only when needed (state, effects, browser APIs)
- Functional components with hooks
- Named exports for components

### Styling

- Tailwind CSS 4 for all styling
- No CSS modules
- Dark mode via `dark:` Tailwind variants
- Custom CSS only in `globals.css` for `.prose-briefing` and `.prose-chat` classes

### Naming

- `camelCase` for variables and functions
- `PascalCase` for components and types
- French language for all user-facing text
- English for code identifiers and comments

## API Development

### Creating a New API Route

```
src/app/api/my-endpoint/route.ts
```

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  // 1. Authenticate
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // 2. Parse & validate
  const body = await request.json()

  // 3. Business logic
  // ...

  // 4. Return response
  return NextResponse.json({ data: result })
}
```

### Cron Endpoints

Use `Authorization: Bearer {CRON_SECRET}` header and GET method. Configure in `vercel.json`.

## Testing

No test framework is currently configured. Testing is planned for Phase 6 (Test & Deploy).

## Deployment

### Vercel

The app is deployed to Vercel (Hobby plan):

1. Connect GitHub repo to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy via `git push` (auto-deploy on main)

### Cron Jobs

Defined in `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/briefing", "schedule": "0 4 * * *" },
    { "path": "/api/ai/triggers", "schedule": "0 5 * * *" }
  ]
}
```

**Note:** Vercel Hobby plan limits to 1 cron/day per endpoint. Pro plan needed for `every 4h` trigger schedule.

## Troubleshooting

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| "ANTHROPIC_API_KEY manquant" | Missing env var | Set in `.env.local` |
| RLS policy error | Missing user_id in query | Use `supabase.auth.getUser()` first |
| Migration fails | Already applied | Migrations are idempotent — safe to re-run |
| Map tiles don't load | CSP or CORS | Check browser console for blocked requests |
| Push notifications fail | Invalid VAPID keys | Regenerate with `web-push generate-vapid-keys` |

### Useful Commands

```bash
# Check TypeScript errors
npx tsc --noEmit

# Check linting
npm run lint

# Build for production (catches SSR issues)
npm run build
```
