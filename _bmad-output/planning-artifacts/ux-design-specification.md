---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - PRD.md
  - VISION.md
  - BUILD_PLAN.md
  - docs/project-overview.md
  - docs/architecture.md
  - docs/ai-system.md
  - docs/api-contracts.md
  - docs/data-models.md
  - docs/component-inventory.md
  - docs/development-guide.md
  - docs/source-tree-analysis.md
  - docs/index.md
  - POC screenshots (8 images)
---

# UX Design Specification — Bosco

**Author:** Seb
**Date:** 2026-03-01

---

<!-- UX design content will be appended sequentially through collaborative workflow steps -->

## Executive Summary

### Project Vision

Bosco is a proactive AI sailing first mate — not a navigation tool, but an intelligent crew member that monitors, anticipates, and speaks to the captain when something needs attention. It centralizes weather, tides, map, logbook, checklist, and route tracking in a single mobile-optimized PWA with an AI copilot (Claude) producing daily GO/STANDBY/NO-GO verdicts and intervening proactively during the day.

The core UX principle: **complexity is in the AI prompt, simplicity is in the interface.** The captain should interact with Bosco like talking to a real first mate — naturally, quickly, and with trust.

### Target Users

**Primary: Solo navigator (Sébastien archetype)**
- Experienced sailor on multi-week convoy passages
- Uses phone one-handed in cockpit, often tired, sometimes in challenging conditions (rain, night, cold)
- Intermittent coastal 4G connectivity, sometimes no connection
- Expects direct, skipper-to-skipper communication — no hand-holding
- Critical constraint: cognitive load is a safety factor in solo sailing

**Secondary: Beta testers (sailing friends)**
- Range from coastal day sailors to long-distance cruisers
- Each configures own boat, profile, and voyage
- Varying experience levels — AI adapts tone and thresholds accordingly

### Key Design Challenges

1. **Cockpit-first design** — Phone in one hand, wet/gloved fingers, direct sunlight or darkness, fatigue after 12+ hours sailing. Every interaction must be achievable with minimal cognitive load and maximum touch target sizes (≥44px).

2. **Information hierarchy under pressure** — The critical question ("Should I leave today?") must be answered in <10 seconds. Secondary information (weather details, fuel levels, route progress) should be available but never compete with the verdict.

3. **Offline-first resilience** — The app must never show blank screens. Cached data with "updated X ago" indicators, pre-generated briefings readable offline, log entries queued locally. The sailor must trust the app to work regardless of connectivity.

4. **Proactive vs. passive UX** — The first mate pushes information via notifications and dashboard alerts. The UI must surface proactive messages without creating notification fatigue. The balance between "helpful crew member" and "annoying alarm system" is critical.

5. **Agentic AI transparency** — The chat uses 7 tools with up to 5 agentic turns. Tool execution must be visible enough for trust but not so verbose that it overwhelms the conversation flow.

### Design Opportunities

1. **Verdict as hero moment** — The daily GO/STANDBY/NO-GO verdict is the primary user motivation. It deserves an immersive, emotionally resonant presentation — full-color, large typography, swipeable details.

2. **Chat as unified interface** — Since the AI can create logs, manage checklists, update routes, and set reminders, the chat could serve as a command center with contextual shortcuts, reducing navigation complexity.

3. **Spatial-first navigation** — For sailors, position is the primary mental reference. The map could serve as a richer navigation hub with contextual overlays (weather, next step, fuel range) rather than being a secondary view.

4. **Progressive disclosure** — Complex data (full briefing markdown, 20-leg route details, checklist categories) should be presented in layers: summary → details on demand. This matches the cockpit context where quick glances are the norm.

## Core User Experience

### Defining Experience

The core experience of Bosco is the **daily verdict ritual**: every morning, the captain opens the app and knows in under 10 seconds whether to cast off or stay in port. This single interaction defines the product's value proposition and must be the most polished, most reliable, most emotionally resonant moment in the entire app.

Everything else — logging, chatting, route tracking, checklists — serves this core loop. The AI first mate proactively maintains the context (via triggers, memory, and background processing) so that the verdict is always accurate and the captain always trusts it.

The secondary core experience is **conversational command**: the captain tells the first mate what happened ("arrived in Lorient, fueled up, autopilot fixed") and the AI handles the data entry (log, route update, checklist, boat status). The interface adapts to the captain, not the other way around.

### Platform Strategy

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Platform | PWA (Progressive Web App) | No app store dependency, installable, offline-capable |
| Primary device | Android phone (360-412px) | Sébastien's device, most common among sailors |
| Input mode | Touch (one-handed, thumb-only) | Cockpit constraint — one hand on tiller/wheel |
| Orientation | Portrait only | One-handed operation, consistent layout |
| Connectivity | Offline-first with sync | Coastal 4G is intermittent, open sea has none |
| Display conditions | High contrast required | Direct sunlight + night mode (red tint for night vision) |
| Touch precision | Low (wet/gloved fingers, boat motion) | Minimum 48px touch targets, generous spacing, no small icons |

### Effortless Interactions

**1. Zero-tap verdict** — The app opens directly to the verdict. No login screen (session persists), no loading spinner (cached briefing), no navigation required. GO/STANDBY/NO-GO fills the screen above the fold.

**2. Three-tap logging** — Entry type chip → fuel/water quick selector → save. GPS position auto-detected, timestamp auto-filled, previous levels pre-loaded as defaults. Offline-queued transparently.

**3. Natural language command** — "Arrivés à Lorient, plein fait, pilote auto réparé" → AI creates log entry, updates boat status (position, fuel, nav_status), checks off autopilot on checklist, updates route step to "done", and confirms in one message. The captain describes reality; the AI handles the bookkeeping.

**4. Glanceable weather** — Wind speed, direction, sea height, and trend visible without scrolling. Uses familiar Beaufort scale notation (F4, F5) alongside knots. Color-coded: green (comfortable), amber (attention), red (dangerous) relative to the sailor's profile.

**5. Proactive push** — The first mate sends push notifications only when actionable: weather change, departure window, low fuel, forgotten log. Never "informational" pushes. Each notification opens directly to the relevant context.

### Critical Success Moments

1. **First briefing moment** — The user completes onboarding, and the next morning receives their first personalized briefing with a verdict tailored to their boat, route, and profile. This is the conversion moment from "trying an app" to "trusting a crew member."

2. **Accurate verdict validation** — The captain checks actual conditions against the verdict and finds it matches reality. This builds the trust loop that keeps them coming back every morning. One bad verdict erodes trust significantly.

3. **Proactive alert in context** — A push notification arrives during sailing with actionable information ("Wind increasing to F6, briefing said F4. Fallback: Concarneau at 12NM, 2h30 at current speed"). This is the moment the AI transitions from "tool" to "crew member."

4. **Effortless log completion** — After a long watch, the captain logs position, fuel, and conditions in under 20 seconds from the cockpit. No frustration, no complex forms, no lost data.

5. **Chat problem-solving** — The captain asks "engine overheating, what do I check?" and receives a structured diagnostic checklist specific to their engine type, with the option to log the issue and create maintenance checklist items — all from the same conversation.

### Experience Principles

| # | Principle | Description | Design Implication |
|---|-----------|-------------|-------------------|
| 1 | **Verdict first, always** | The GO/STANDBY/NO-GO verdict is the reason the app exists. It must dominate every morning interaction. | Verdict is full-screen above the fold on dashboard. Everything else is below or in tabs. |
| 2 | **Act first, confirm after** | The AI takes action proactively and confirms what it did. Never asks permission for routine operations. | Chat shows action summaries, not confirmation dialogs. Tool execution is visible but non-blocking. |
| 3 | **Cockpit-grade simplicity** | Every screen must be usable with one wet hand on a moving boat in direct sunlight or total darkness. | 48px+ touch targets, high contrast, no hover states, no small text, no precise gestures. |
| 4 | **Offline is normal** | No connection is an expected state, not an error. The app works with cached data and syncs transparently. | Never show "no connection" errors. Show "updated 3h ago" instead. Queue all writes locally. |
| 5 | **Progressive disclosure** | Show the minimum needed, reveal details on demand. The captain scanning from the cockpit needs headlines; at anchor, they want the full briefing. | Summary cards that expand. Swipeable detail layers. Collapsible sections. |
| 6 | **Trust through transparency** | The AI always shows its data sources, confidence level, and reasoning. The captain is responsible for decisions — the AI provides recommendations. | Briefings cite sources. Verdict shows confidence. Weather data is timestamped. |
