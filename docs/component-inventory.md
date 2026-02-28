# Bosco — Component Inventory

**Generated:** 2026-02-28 | **Scan Level:** Exhaustive

## Overview

Bosco uses a flat component structure — most UI logic lives directly in page files (`page.tsx`) rather than being extracted into reusable components. Shared components exist only where reuse is clearly needed.

**Total:** 8 shared components + 12 page components (all `'use client'`).

## Shared Components

### Providers (`src/components/Providers.tsx` — 12 lines)

Root composition of React context providers.

```
<AuthProvider>
  <ThemeProvider>
    {children}
  </ThemeProvider>
</AuthProvider>
```

Used in: `src/app/layout.tsx`

---

### BottomNav (`src/components/layout/BottomNav.tsx` — 64 lines)

5-tab bottom navigation bar for the app shell.

| Tab | Label | Icon | Route |
|-----|-------|------|-------|
| 1 | Accueil | Home | `/` |
| 2 | Route | Map pin | `/route` |
| 3 | Journal | Book | `/log` |
| 4 | Chat | Message | `/chat` |
| 5 | Plus | Menu | `/more` |

Active tab highlighted based on current pathname. Touch targets ≥ 44px. Supports safe-area insets for iOS.

Used in: `src/app/(app)/layout.tsx`

---

### MiniMapView (`src/components/map/MiniMapView.tsx` — 104 lines)

Non-interactive Leaflet map for dashboard and route preview contexts.

**Props:** Route steps (polylines), current position marker, zoom level.
**Features:** Dark mode tiles (CartoDB Dark Matter), OpenSeaMap overlay, auto-fit bounds.
**Interaction:** Disabled (no zoom, no pan, no scroll) — read-only display.

Used in: Dashboard (`page.tsx`), Route page.

---

### AIRouteWizard (`src/components/voyage/AIRouteWizard.tsx` — 690 lines)

Multi-step AI route generation wizard with streaming and map preview.

**Flow:**
1. User enters departure + arrival ports
2. Calls `/api/ai/route` → Claude generates 2-3 options
3. Displays option cards with distance, days, pros/cons, warnings
4. User selects an option OR chooses "Other" with free text
5. Preview selected route on interactive map
6. Confirm → saves route_steps and initializes boat_status

**Features:**
- SSE streaming for progress feedback during generation
- Map preview with waypoints and colored polylines per phase
- "Other" option: free-text description → single custom route
- Error handling with retry

Used in: Onboarding (step 3), Settings (voyage creation/editing).

---

### RoutePreviewMap (`src/components/voyage/RoutePreviewMap.tsx` — 237 lines)

Interactive Leaflet map for route visualization with waypoints.

**Props:** Steps array, optional current position, optional selected step highlight.
**Features:**
- Colored polylines per phase (Atlantic=blue, Canal=green, Mediterranean=orange)
- Numbered waypoint markers at each port
- Popup with step details (name, distance, phase, notes)
- Auto-fit bounds to show all steps
- Dark mode tile support

Used in: AIRouteWizard, Route page, Map page.

---

### Card (`src/components/ui/Card.tsx` — 39 lines)

Generic card container with smart background detection.

**Props:** `className`, `children`, standard div props.
**Feature:** Auto-detects if a custom background color class is passed (e.g., `bg-green-50`) and skips the default `bg-white dark:bg-gray-800` to avoid overriding it.

Used in: Dashboard, Briefings, Settings, Route — throughout the app.

---

### LoadingSpinner (`src/components/ui/LoadingSpinner.tsx` — 25 lines)

Animated spinner with optional text label.

**Props:** `text` (optional string), `size` (sm/md/lg).
**Rendering:** CSS animation, centered layout.

Used in: Multiple pages during data loading.

---

### Skeleton (`src/components/ui/Skeleton.tsx` — 7 lines)

Pulse placeholder for loading states.

**Props:** `className` (for sizing).
**Rendering:** Tailwind `animate-pulse` with gray background.

Used in: Dashboard cards during initial load.

## Page Components

All pages under `src/app/(app)/` are client components with inline logic.

| Page | File | Lines | Key Features |
|------|------|-------|-------------|
| **Dashboard** | `(app)/page.tsx` | 973 | Verdict card, weather summary, fuel/water levels, route progress, mini map, mate messages |
| **Briefings** | `briefings/page.tsx` | 566 | Markdown rendering (react-markdown), verdict filter, history list, delete with confirmation |
| **Chat** | `chat/page.tsx` | 587 | SSE streaming consumption, tool call badges, suggestion chips, auto-scroll |
| **Checklist** | `checklist/page.tsx` | 615 | 6 category tabs, 4 priority levels, CRUD operations, batch actions |
| **Logbook** | `log/page.tsx` | 1,018 | Entry form (GPS, fuel, water, photos, notes), offline queue, history timeline |
| **Map** | `map/page.tsx` + `MapView.tsx` | 137 + 246 | Full-screen Leaflet, route polylines, GPS center button, dark tiles |
| **Route** | `route/page.tsx` | 967 | Phase groups, step status toggle, CRUD steps, progress bar, map preview |
| **Reminders** | `reminders/page.tsx` | 315 | Pending/past sections, dismiss, delete |
| **Settings** | `settings/page.tsx` | 1,517 | Boat form, profile form, voyage management (create/edit/switch/delete), push toggle, sign out |
| **More** | `more/page.tsx` | 116 | Theme picker (dark/light/system), nav links, sign out |
| **Login** | `login/page.tsx` | 140 | Email input, magic link via signInWithOtp, "check email" state |
| **Onboarding** | `onboarding/page.tsx` | 1,040 | 4-step wizard: Boat → Profile → Voyage (AIRouteWizard) → Done |

## Custom Hooks

| Hook | File | Lines | Purpose |
|------|------|-------|---------|
| `useGeolocation` | `hooks/useGeolocation.ts` | 49 | Browser GPS via `getCurrentPosition` |
| `usePushNotifications` | `hooks/usePushNotifications.ts` | 102 | Subscribe/unsubscribe to Web Push |
| `useOnlineStatus` | `hooks/useOnlineStatus.ts` | 24 | Online/offline detection via events |
| `useServiceWorker` | `hooks/useServiceWorker.ts` | 13 | SW registration on mount |

## Auth Hooks

| Hook | File | Lines | Purpose |
|------|------|-------|---------|
| `useAuth` | `lib/auth/context.tsx` | 82 | Session, user, loading, signOut |
| `useUser` | `lib/auth/hooks.ts` | ~60 | Extended user profile from `users` table |
| `useActiveVoyage` | `lib/auth/hooks.ts` | ~120 | Active voyage + boat + profile + status |

## UI Patterns

### Color Conventions

| Verdict | Color | Tailwind |
|---------|-------|----------|
| GO | Green | `bg-green-500 / text-green-600` |
| STANDBY | Amber | `bg-amber-500 / text-amber-600` |
| NO-GO | Red | `bg-red-500 / text-red-600` |

### Dark Mode

All components use Tailwind `dark:` variants. Theme is controlled by `ThemeProvider` which adds/removes `class="dark"` on `<html>`.

### Responsive Design

Mobile-first (360px baseline). No desktop-specific layouts — the app is designed for phone use in a sailing cockpit. Touch targets ≥ 44x44px throughout.

### Map Dark Mode

| Mode | Base Tiles | Overlay |
|------|-----------|---------|
| Light | OpenStreetMap default | OpenSeaMap |
| Dark | CartoDB Dark Matter | OpenSeaMap (preserved) |
