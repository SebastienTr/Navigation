# Bosco — AI System Deep Dive

**Generated:** 2026-02-28 | **Scan Level:** Exhaustive | **Focus Area**

## Overview

Bosco's AI system is the brain of the application — a proactive sailing first mate that monitors conditions, generates daily briefings, answers questions, takes actions, and intervenes when something needs attention.

The architecture is deliberately simple: all intelligence lives in **carefully crafted system prompts + rich context injection**. No ML, no fine-tuning, no complex event processing.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (PWA)                          │
│                                                         │
│  Chat Page ───── SSE Stream ────► /api/chat             │
│  Dashboard ───── POST ──────────► /api/briefing         │
│  Onboarding ─── POST ──────────► /api/ai/route          │
│  (passive) ◄─── Web Push ──────◄ /api/ai/triggers       │
│                                                         │
└─────────────────────────────────────────────────────────┘
                         │
┌─────────────────────────────────────────────────────────┐
│                   SERVER (Next.js API)                   │
│                                                         │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐            │
│  │ context  │   │ prompts  │   │  proxy   │            │
│  │ builder  │──►│ builder  │──►│ (Claude) │            │
│  └──────────┘   └──────────┘   └──────────┘            │
│       │                             │                   │
│       │ (reads)              (tool_use loop)            │
│       ▼                             ▼                   │
│  ┌──────────┐              ┌──────────────┐            │
│  │ Supabase │◄─────────────│tool-handlers │            │
│  │ queries  │              │  (mutations) │            │
│  └──────────┘              └──────────────┘            │
│       │                                                 │
│       ▼                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐           │
│  │ Weather  │   │  Tides   │   │  Push    │           │
│  │Open-Meteo│   │WorldTides│   │  VAPID   │           │
│  └──────────┘   └──────────┘   └──────────┘           │
└─────────────────────────────────────────────────────────┘
```

## Models

| Use Case | Model | ID | Rationale |
|----------|-------|----|-----------|
| Agentic Chat (with tools) | Claude Sonnet 4.6 | `claude-sonnet-4-6` | Best tool_use accuracy |
| Simple Chat (no tools) | Claude Haiku 4.5 | `claude-haiku-4-5-20251001` | Fast, cheap |
| Daily Briefings | Claude Sonnet 4.6 | `claude-sonnet-4-6` | Complex analysis needed |
| Route Proposals | Claude Sonnet 4.6 | `claude-sonnet-4-6` | Geographic reasoning |
| Trigger Messages | Claude Haiku 4.5 | `claude-haiku-4-5-20251001` | Short notifications |
| Memory Extraction | Claude Haiku 4.5 | `claude-haiku-4-5-20251001` | Simple JSON extraction |

**Note:** The chat endpoint uses `MODEL_CHAT_TOOLS` (Sonnet) when tools are available, not Haiku, because Sonnet is significantly better at structured tool_use decisions.

## Key Files

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/ai/prompts.ts` | 594 | 4 system prompt builders (briefing, chat, trigger, route) |
| `src/lib/ai/tools.ts` | 290 | 7 tool definitions in Anthropic tool_use format |
| `src/lib/ai/tool-handlers.ts` | 743 | Tool execution — Supabase mutations + weather fetch |
| `src/lib/ai/context.ts` | 337 | 3 context builders (briefing, chat, trigger) |
| `src/lib/ai/proxy.ts` | 276 | Anthropic SDK wrapper — streaming, non-streaming, agentic loop |
| `src/lib/ai/route.ts` | 271 | Route proposal generation + JSON parsing/validation |
| `src/lib/triggers/engine.ts` | 213 | Trigger evaluation orchestrator |
| `src/lib/triggers/rules.ts` | 256 | 5 trigger rule implementations |

## System Prompts

### Personality & Language

All prompts share a consistent personality:
- **Role:** "Second de bord" (first mate) of the boat
- **Language:** Always French
- **Units:** Nautical (knots, nautical miles) + metric
- **Style:** Direct, professional, safety-first
- **Adaptation:** Adjusts tone based on navigator experience level (Beginner → reassuring; Pro → skipper-to-skipper)

The experience adaptation is handled by `formatExperience()` which returns different instructions based on `nav_profile.experience`.

### 1. Briefing System Prompt (`buildBriefingSystemPrompt`)

**Input:** `BriefingContext` — boat, profile, boat_status, route, logs, weather (current + destination), tides, checklist, memory, date.

**Output format:** Structured markdown with sections:
- VERDICT (GO / STANDBY / NO-GO) with confidence level
- Weather (wind, sea, visibility, precipitation, 24-48h trend)
- Tide conditions (times, currents, favorable windows)
- Navigation plan (departure time, distance, duration, attention points, refuge ports)
- Boat state (fuel, water, active problems, checklist reminders)
- Recommendations (priority actions, daily vigilance points)
- Sources & Verification (clickable links to Windy, Météo France, etc.)

**Context injection includes:**
- Full boat specs (name, type, dimensions, engine, equipment)
- Navigator profile (experience, crew mode, risk tolerance, night sailing, max hours)
- Current boat status (position, coordinates, fuel, water, problems, nav status)
- Route summary (progress, current step, next 3 steps)
- Last 5 log entries
- Weather at current position (from Open-Meteo enhanced)
- Weather at destination (if current step has coordinates)
- Tides at current position (from WorldTides)
- Weather source URLs for verification links
- Pending checklist items (grouped by priority)
- AI memory documents (situation, boat, crew, preferences)

### 2. Chat System Prompt (`buildChatSystemPrompt`)

**Input:** `ChatContext` — everything in BriefingContext + latest briefing, recent chat history, reminders.

**Key difference from briefing:** Includes detailed tool usage instructions for each of the 7 tools, with specific examples of when to use each one.

**Behavioral rules:**
- "Act first, confirm after" — no asking permission before taking action
- Use incomplete information and ask for the rest
- Brief confirmation after each action
- Never fabricate data (GPS, levels, weather)
- Execute multiple actions if needed (e.g., "arrived at Camaret, mark step done, fuel up")

### 3. Trigger System Prompt (`buildTriggerSystemPrompt`)

**Input:** `TriggerContext` — boat, boat_status, logs, latest briefing, checklist, memory, date + trigger type.

**Output:** JSON object with `title` (max 50 chars), `body` (max 150 chars), `priority` (high/medium/low).

Minimal prompt — just enough context for a short, actionable push notification.

### 4. Route System Prompt (`buildRouteSystemPrompt`)

**Input:** Departure port, arrival port, boat specs, navigator profile, optional custom description.

**Output:** JSON array of 2-3 route proposals (or 1 custom route), each with:
- Name, summary, distances (NM + km), estimated days
- Pros, cons, warnings (boat-specific)
- Detailed steps with GPS coordinates, distances, phases, notes

**Critical geographic constraints built into the prompt:**
- Cannot go Atlantic → Mediterranean by sea without Gibraltar (>2000 NM)
- French inland passages: Canal de la Garonne + Canal du Midi (Bordeaux → Sète) or Rhône
- Air draft > 6m = canals not practicable (fixed bridges ~3.5m)
- Draft > 1.8m = inland canal limitations

## Agentic Chat (Tool Use Loop)

### Architecture

The chat uses Claude's native `tool_use` capability with a **multi-turn agentic loop** (max 5 turns).

```
User Message
    │
    ▼
┌─────────────┐     ┌──────────────┐
│ Claude API  │────►│  Response     │──── stop_reason: "end_turn" ──► Final text
│ (streaming) │     │  Analysis     │
└─────────────┘     └──────────────┘
                          │
                   stop_reason: "tool_use"
                          │
                          ▼
                    ┌──────────────┐
                    │  Execute     │──── SSE: tool_call_start
                    │  Tool(s)     │──── SSE: tool_call_result
                    └──────────────┘
                          │
                          ▼
                    Append tool_result
                    to messages
                          │
                          ▼
                    Loop (up to 5 turns)
```

### SSE Event Types

The chat endpoint streams 4 types of Server-Sent Events:

| Event Type | Payload | When |
|------------|---------|------|
| `text_delta` | `{ text: string }` | Claude generates text |
| `tool_call_start` | `{ tool_name, tool_call_id }` | Claude invokes a tool |
| `tool_call_result` | `{ tool_name, tool_call_id, success, summary }` | Tool execution completes |
| `message_stop` | `{ usage: { input_tokens, output_tokens } }` | Stream ends |
| `error` | `{ error: string }` | Error occurred |

### Flow Detail (`callClaudeWithTools` in proxy.ts)

1. Receive system prompt, messages, tool definitions
2. Call Claude API with streaming enabled
3. Stream text deltas to client via `onTextDelta` callback
4. If `stop_reason === 'tool_use'`:
   - Extract `ToolUseBlock` from response
   - Notify client via `onToolCallStart` callback
   - Execute tool via `executeToolCall()` dispatcher
   - Notify client via `onToolCallResult` callback
   - Append assistant response + tool_result to message history
   - Loop back to step 2
5. If `stop_reason !== 'tool_use'`: return final text + usage stats
6. Max 5 turns → graceful fallback message

### Chat History Persistence

- User messages saved **before** Claude call (with context snapshot: position, weather status, date)
- Assistant messages saved **after** stream completes (text + tool_calls serialized as JSON if tools were used)
- Last 20 messages loaded as conversation context for continuity

## 7 AI Tools

### Tool Definition Format

Tools are defined using Anthropic's `Tool` type (JSON Schema for `input_schema`):

```typescript
{
  name: 'tool_name',
  description: 'When and how to use this tool',
  input_schema: {
    type: 'object',
    properties: { ... },
    required: ['field1', 'field2'],
  }
}
```

### Tool Catalog

#### 1. `create_log_entry`
**Purpose:** Create a logbook entry and auto-update boat_status.
**Required:** `position`, `entry_type` (navigation/arrival/departure/maintenance/incident)
**Optional:** `latitude`, `longitude`, `fuel_tank`, `jerricans`, `water`, `problems`, `notes`
**Side effects:** Updates `boat_status` (position, fuel, water, nav_status based on entry_type)

#### 2. `manage_checklist`
**Purpose:** Full CRUD on checklist items.
**Actions:** `add`, `check`, `uncheck`, `delete`, `edit`, `list`
**Search:** Fuzzy matching via SQL `ILIKE %task%` for check/uncheck/delete/edit
**Categories:** Safety, Propulsion, Navigation, Rigging, Comfort, Admin
**Priorities:** Critical, High, Normal, Low

#### 3. `update_boat_status`
**Purpose:** Update boat state without a full log entry.
**Fields:** `current_position`, `current_lat`, `current_lon`, `fuel_tank`, `jerricans`, `water`, `nav_status` (in_port/sailing/at_anchor/in_canal), `active_problems`

#### 4. `manage_route`
**Purpose:** Full CRUD on route steps.
**Actions:** `update_status` (done/in_progress), `add_step`, `edit_step`, `delete_step`, `list`
**Auto-progression:** When marking a step as "done", the next step auto-transitions to "in_progress" and boat_status updates to the new step's departure port.
**Step insertion:** Supports `after_step_name` for inserting between existing steps (with order_num re-numbering).

#### 5. `create_reminder`
**Purpose:** Schedule a reminder.
**Required:** `message`, `remind_at` (ISO 8601)
**Optional:** `category` (navigation/safety/maintenance/provisions/general), `priority` (high/medium/low)
**Integration:** Reminders are evaluated by the trigger engine and delivered via push notification.

#### 6. `get_weather`
**Purpose:** Fetch marine weather for specific coordinates.
**Required:** `latitude`, `longitude`
**Optional:** `location_name`
**Implementation:** Calls the internal `/api/weather` endpoint which proxies Open-Meteo.

#### 7. `update_memory`
**Purpose:** Update persistent AI memory documents.
**Required:** `slug` (situation/boat/crew/preferences), `content` (replaces entire document)
**Proactive usage:** Claude is instructed to use this tool proactively when the captain shares important information.
**Versioning:** Each update creates a version in `ai_memory_versions`, keeping the last 5 versions.

### Tool Handler Architecture

All handlers follow the same pattern:

```
executeToolCall(toolName, toolInput, context)
  └─► TOOL_HANDLERS[toolName](input, ctx)
        ├── ctx.supabase (admin client, bypasses RLS)
        ├── ctx.userId
        └── ctx.voyageId
```

The admin client is used because authentication is verified at the API route level before tool execution begins.

## Context Building

Three context builders gather data from Supabase in parallel using `Promise.all`:

### `buildBriefingContext`
Fetches: boat + profile, boat_status, last 10 logs, route_steps, checklist, memory.
Then conditionally fetches: weather (current position), tides, weather (destination).

### `buildChatContext`
Fetches: everything in briefing context + latest briefing, last 20 chat messages, last 10 reminders.

### `buildTriggerContext`
Fetches: boat, boat_status, last 5 logs, latest briefing, checklist, route_steps, memory.

Weather and tides are fetched from the internal API endpoints (which proxy Open-Meteo and WorldTides respectively). Source URLs for Windy, Météo France, etc. are generated from coordinates for inclusion in briefings.

## Trigger System

### Architecture

Triggers are evaluated by a **Vercel Cron Job** that runs daily at 5am UTC (ideally every 4h with Pro plan).

```
Cron ─► /api/ai/triggers
           │
           ├── Query all active voyages
           │
           └── For each voyage:
                 ├── Gather context (parallel Supabase queries)
                 ├── Fetch current weather
                 ├── Run 5 rules
                 ├── Check pending reminders
                 ├── For each fired trigger:
                 │     ├── Generate Claude message
                 │     └── Send push notification
                 └── Mark reminders as fired
```

### 5 Trigger Rules

| # | Rule | Condition | Threshold |
|---|------|-----------|-----------|
| 1 | **Weather Change** | Wind forecast changed vs morning briefing | > 10 kn difference |
| 2 | **Log Reminder** | No logbook entry | > 12 hours |
| 3 | **Departure Watch** | Briefing verdict = GO + in port | Same day |
| 4 | **Critical Checklist** | Critical items unchecked + GO/STANDBY verdict + in port | Any unchecked |
| 5 | **Low Fuel** | Fuel level below threshold | ≤ 25% |

### Rule Implementation Details

- **Weather Change:** Parses wind numbers from both the briefing `wind` field and the current weather summary using regex. Compares max wind values.
- **Log Reminder:** Simple time comparison — `(now - lastLog.created_at) > 12h`.
- **Departure Watch:** Checks if latest briefing is from today with GO verdict AND boat is in_port or at_anchor. Lists pending critical/high priority checklist items.
- **Critical Checklist:** Fires when critical items are unchecked AND latest briefing is GO or STANDBY AND boat is in port.
- **Low Fuel:** Maps fuel_tank enum to percentages (full=100, 3/4=75, half=50, 1/4=25, reserve=10, empty=0). Includes jerrican count and next port info.

### Reminder Integration

In addition to the 5 rules, the trigger engine also:
1. Queries pending reminders (`status = 'pending' AND remind_at <= now`)
2. Marks them as fired (`status = 'fired', fired_at = now`)
3. Sends push notifications for each

## AI Memory System

### Purpose

Persistent memory across chat sessions. The AI can "remember" important context between conversations — the current situation, boat issues, crew composition, captain's preferences.

### Storage

- **`ai_memory` table:** 4 documents per voyage (slugs: situation, boat, crew, preferences)
- **`ai_memory_versions` table:** Version history, keeps last 5 versions per document
- **Unique constraint:** `(voyage_id, slug)` — one document per slug per voyage

### Write Paths

1. **Chat tool (`update_memory`):** Real-time updates during conversation. Claude proactively updates memory when the captain shares important info.
2. **Cron extraction (`/api/ai/memory-extract`):** Batch process that reads last 48h of chat history, compares against current memory, and updates if new info is found. Uses Claude Haiku for JSON extraction.

### Read Paths

Memory documents are injected into:
- Briefing system prompt (via `buildBriefingContext`)
- Chat system prompt (via `buildChatContext`)
- Trigger context (via `buildTriggerContext`)

### Version Management

Each update (from chat or cron):
1. Increments version number
2. Saves new version to `ai_memory_versions`
3. Prunes versions older than the 5th most recent
4. Updates main document with new content

## Route Proposal System

### Flow

```
User enters departure + arrival
        │
        ▼
/api/ai/route (POST)
        │
        ├── Fetch boat specs + nav profile
        ├── Build route system prompt
        ├── Call Claude Sonnet (maxTokens: 8192)
        ├── Extract JSON from response
        ├── Validate each proposal
        │     ├── Required: name, steps
        │     ├── Each step: from_port, to_port, coordinates
        │     └── Coordinates must be numbers
        └── Return parsed RouteProposal[]
```

### JSON Extraction (`extractJSON`)

Three-layer parsing strategy for robustness:
1. Direct `JSON.parse()` on full response
2. Extract from markdown code block (` ```json ... ``` `)
3. Find first `{` to last `}` and parse that substring

### Custom Routes

When the user selects "Other" in the route wizard, they provide a free-text description. The prompt switches to single-route mode with `customDescription` injected, and Claude generates exactly 1 route matching the description.

## Daily Briefing System

### Flow

Two entry points:
1. **Manual:** `POST /api/briefing` — user-triggered, authenticated via session
2. **Cron:** `GET /api/briefing` — daily at 4am UTC, authenticated via CRON_SECRET

### Cron Flow

1. Query all active voyages (admin client, bypasses RLS)
2. For each voyage:
   - Build briefing context (parallel data fetching)
   - Call Claude Sonnet
   - Parse verdict, confidence, wind, sea from markdown response
   - Save to `briefings` table
   - Send push notification with verdict

### Verdict Parsing (`parseVerdictFromContent`)

Extracts structured data from unstructured markdown:
- **Verdict:** Regex `\*?\*?(GO|STANDBY|NO-GO)\*?\*?` — handles bold markdown
- **Confidence:** Regex for "Confiance: haute/moyenne/basse" (French + English)
- **Wind:** First line containing "Vent:" followed by text
- **Sea:** First line containing "Mer:" followed by text

## Security Model

- **Single API key:** Server-side `ANTHROPIC_API_KEY` shared across all users (BYOAI planned for V1.5)
- **Singleton client:** Anthropic SDK instance created once and reused
- **Auth verification:** All API routes verify Supabase session before processing
- **Admin client for tools:** Tool handlers use the service role client (bypasses RLS) because auth is verified at the route level
- **Cron authentication:** CRON_SECRET in Bearer token for trigger and briefing cron endpoints
- **No user data in AI calls:** User content flows through Claude but the API key is server-side only
