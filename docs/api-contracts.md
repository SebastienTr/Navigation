# Bosco — API Contracts

**Generated:** 2026-02-28 | **Scan Level:** Exhaustive

## Overview

9 API endpoints, all implemented as Next.js Route Handlers (`route.ts`). All endpoints are server-side only.

## Authentication

| Type | Method | Used By |
|------|--------|---------|
| **Session** | Supabase cookies (via `createClient()`) | User-facing endpoints |
| **Cron** | `Authorization: Bearer {CRON_SECRET}` | Cron job endpoints |

## Endpoints

---

### 1. `POST /api/chat`

**Purpose:** Agentic AI chat with tool use and SSE streaming.

**Auth:** Session (user must own the voyage)

**Request:**
```json
{
  "message": "string (required)",
  "voyageId": "string (required)"
}
```

**Response:** `text/event-stream` (SSE)

**SSE Events:**
```
data: {"type":"text_delta","text":"..."}
data: {"type":"tool_call_start","tool_name":"create_log_entry","tool_call_id":"toolu_..."}
data: {"type":"tool_call_result","tool_call_id":"toolu_...","tool_name":"create_log_entry","success":true,"summary":"..."}
data: {"type":"message_stop","usage":{"input_tokens":1234,"output_tokens":567}}
data: {"type":"error","error":"..."}
```

**Model:** Claude Sonnet 4.6 (with tools)
**Max tokens:** 4096
**Max tool turns:** 5

**Side effects:**
- Saves user message to `chat_history` (before AI call)
- Saves assistant response to `chat_history` (after stream completes)
- Tool handlers may mutate: `logs`, `boat_status`, `checklist`, `route_steps`, `reminders`, `ai_memory`

---

### 2. `POST /api/briefing`

**Purpose:** Generate a daily briefing on demand.

**Auth:** Session

**Request:** None (uses active voyage)

**Response:**
```json
{
  "id": "uuid",
  "content": "markdown string",
  "verdict": "GO" | "STANDBY" | "NO-GO" | null,
  "confidence": "high" | "medium" | "low" | null,
  "wind": "string | null",
  "sea": "string | null",
  "date": "2026-03-01",
  "saved": true
}
```

**Model:** Claude Sonnet 4.6
**Side effects:** Inserts row into `briefings` table

---

### 3. `GET /api/briefing`

**Purpose:** Cron job — generate briefings for ALL active voyages.

**Auth:** `Authorization: Bearer {CRON_SECRET}`

**Schedule:** `0 4 * * *` (4am UTC daily)

**Response:**
```json
{
  "message": "Briefings générés : 3/3",
  "generated": 3,
  "total": 3,
  "results": [
    {
      "userId": "uuid",
      "voyageId": "uuid",
      "voyageName": "Audierne → Nice",
      "verdict": "GO",
      "success": true
    }
  ]
}
```

**Side effects:**
- Inserts briefing for each active voyage
- Sends push notification per user with verdict

---

### 4. `POST /api/ai/proxy/route`

**Purpose:** Raw Claude API proxy with SSE streaming.

**Auth:** Session

**Request:**
```json
{
  "messages": [{"role": "user", "content": "..."}],
  "systemPrompt": "string",
  "model": "claude-haiku-4-5-20251001",
  "maxTokens": 4096
}
```

**Response:** `text/event-stream` (SSE)

**SSE Events:**
```
data: {"type":"text_delta","text":"..."}
data: {"type":"message_stop","usage":{...}}
data: {"type":"error","error":"..."}
```

---

### 5. `POST /api/ai/route`

**Purpose:** Generate AI route proposals (2-3 options or 1 custom).

**Auth:** Session

**Request:**
```json
{
  "departure": "Audierne",
  "arrival": "Nice",
  "customDescription": "optional — triggers single custom route"
}
```

**Response:**
```json
{
  "routes": [
    {
      "name": "Route Atlantic + Canals",
      "summary": "...",
      "totalDistanceNm": 520,
      "totalDistanceKm": 420,
      "estimatedDays": 30,
      "pros": ["..."],
      "cons": ["..."],
      "warnings": ["Air draft 12m: canaux impraticables"],
      "steps": [
        {
          "orderNum": 1,
          "name": "Audierne → Lorient",
          "fromPort": "Audierne",
          "toPort": "Lorient",
          "fromLat": 48.0089,
          "fromLon": -4.5443,
          "toLat": 47.7486,
          "toLon": -3.3600,
          "distanceNm": 45,
          "distanceKm": null,
          "phase": "Atlantic",
          "notes": "Passage du Raz de Sein..."
        }
      ]
    }
  ]
}
```

**Model:** Claude Sonnet 4.6 (maxTokens: 8192)
**Errors:** 400 (missing fields), 401 (not authenticated), 500 (Claude/parse error)

---

### 6. `GET /api/ai/triggers`

**Purpose:** Cron job — evaluate 5 trigger rules for all active voyages.

**Auth:** `Authorization: Bearer {CRON_SECRET}`

**Schedule:** `0 5 * * *` (5am UTC daily — ideally every 4h with Pro plan)

**Time window:** Only runs between 6am and 10pm Paris time.

**Response:**
```json
{
  "message": "Triggers evalues pour 2 voyage(s). 1 declencheur(s), 1 notification(s).",
  "evaluated": 2,
  "totalFired": 1,
  "totalNotifications": 1,
  "summaries": [
    {
      "userId": "uuid",
      "voyageId": "uuid",
      "voyageName": "Audierne → Nice",
      "triggersFired": ["low_fuel"],
      "notificationsSent": 1,
      "errors": []
    }
  ]
}
```

**Side effects:**
- Sends push notifications for fired triggers
- Marks pending reminders as fired

---

### 7. `GET /api/ai/memory-extract`

**Purpose:** Cron job — extract and update AI memory from recent chat conversations.

**Auth:** `Authorization: Bearer {CRON_SECRET}`

**Response:**
```json
{
  "message": "Memory extraction: 2/2 voyages traités, 1 mis à jour",
  "processed": 2,
  "updated": 1,
  "total": 2,
  "results": [
    {
      "userId": "uuid",
      "voyageId": "uuid",
      "voyageName": "Audierne → Nice",
      "updated": ["situation", "boat"],
      "success": true
    }
  ]
}
```

**Side effects:** Updates `ai_memory` documents and creates `ai_memory_versions` entries.

---

### 8. `GET /api/weather`

**Purpose:** Proxy to Open-Meteo marine + forecast APIs.

**Auth:** Session

**Query params:** `lat`, `lon`

**Response:** Weather data object with `summary` field (formatted text).

**Cache:** 1 hour (`revalidate: 3600`)

---

### 9. `GET /api/tides`

**Purpose:** Proxy to WorldTides API v3.

**Auth:** Session

**Query params:** `lat`, `lon`

**Response:** Tide data object with extremes, heights, and `summary` field.

**Cache:** 6 hours (`revalidate: 21600`)

---

### 10. `POST /api/push`

**Purpose:** Subscribe/unsubscribe from Web Push notifications.

**Auth:** Session

**Request (subscribe):**
```json
{
  "action": "subscribe",
  "subscription": { "endpoint": "...", "keys": { "p256dh": "...", "auth": "..." } }
}
```

**Request (unsubscribe):**
```json
{
  "action": "unsubscribe",
  "endpoint": "https://fcm.googleapis.com/..."
}
```

## Error Handling Pattern

All endpoints follow the same pattern:
```typescript
try {
  // Auth check → 401
  // Validation → 400
  // Not found → 404
  // Business logic → success
} catch (error) {
  console.error(...)
  return NextResponse.json({ error: message }, { status: 500 })
}
```

## Cron Configuration (`vercel.json`)

```json
{
  "crons": [
    { "path": "/api/briefing", "schedule": "0 4 * * *" },
    { "path": "/api/ai/triggers", "schedule": "0 5 * * *" }
  ]
}
```

Note: Memory extraction (`/api/ai/memory-extract`) is not yet in the cron config — currently manual only.
