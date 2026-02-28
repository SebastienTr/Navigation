# Bosco — Project Overview

**Generated:** 2026-02-28 | **Scan Level:** Exhaustive | **Type:** Full-stack Next.js PWA

## Executive Summary

Bosco is an AI-powered sailing first mate — a multi-user Progressive Web App that helps sailors make daily go/no-go decisions and navigate safely. It centralizes weather, tides, map, logbook, checklist, and route tracking with an AI copilot (Claude) that produces an operational verdict each morning (GO / STANDBY / NO-GO) and intervenes proactively during the day.

Built initially for Sébastien's solo convoy from Audierne (Finistère, France) to Nice, but designed as a multi-user platform from day 1.

## Key Metrics

| Metric | Value |
|--------|-------|
| Source files | 63 TypeScript/TSX |
| Lines of code | ~17,000+ |
| Database tables | 13 (6 migrations) |
| API endpoints | 9 |
| AI tools (agentic) | 7 |
| Trigger rules | 5 |
| Pages/views | 12 |
| Shared components | 8 |
| Custom hooks | 4 |

## Architecture Type

**Component-based Full-stack Monolith** — React client pages with Next.js API routes, PostgreSQL via Supabase, server-side AI proxy.

## Repository Structure

- **Monolith** — Single codebase, no separate client/server
- **Framework:** Next.js 16 App Router
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS 4
- **Database:** Supabase (PostgreSQL + Auth + RLS)
- **AI:** Claude API (Haiku for chat, Sonnet for briefings/routes)
- **Maps:** Leaflet + OpenSeaMap
- **Hosting:** Vercel + Supabase (free tiers)

## Technology Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Next.js + React + TypeScript | 16.1.6 / 19.2.3 / ^5 |
| Styling | Tailwind CSS | ^4 |
| Maps | Leaflet + react-leaflet | 1.9.4 / 5.0.0 |
| Database | Supabase (PostgreSQL) | 2.98.0 |
| Auth | Supabase Auth (magic link) | via @supabase/ssr 0.8.0 |
| AI | Anthropic Claude API | SDK 0.78.0 |
| Weather | Open-Meteo (free) | — |
| Tides | WorldTides API v3 | — |
| Push | web-push (VAPID) | 3.6.7 |
| Hosting | Vercel (Hobby) | — |

## Implementation Status

| Area | Status | Lines |
|------|--------|-------|
| Auth (magic link + middleware) | Done | ~240 |
| Onboarding (4-step wizard + AI routes) | Done | ~1,040 |
| Dashboard | Done | ~973 |
| Map (Leaflet + OpenSeaMap + dark mode) | Done | ~381 |
| Logbook (entry + GPS + history) | Done | ~1,018 |
| AI Chat (streaming + agentic tools) | Done | ~587 |
| Briefings (generation + markdown + history) | Done | ~566 |
| Checklist (categories + priorities) | Done | ~615 |
| Route progress + editing | Done | ~967 |
| Reminders | Done | ~315 |
| Settings (boat + profile + voyages) | Done | ~1,517 |
| API routes (9 endpoints) | Done | ~1,634 |
| AI system (proxy + context + prompts + tools) | Done | ~2,481 |
| Trigger engine (5 rules) | Done | ~467 |
| Weather + Tides clients | Done | ~302 |
| Supabase (types + queries + clients) | Done | ~1,152 |
| Theme system + PWA | Done | ~220 |

**Remaining work:**
- Phase 6 (Test & Deploy) — not started
- Advanced offline sync — partial
- Push wiring to triggers/briefings — partial

## Related Documentation

- [Architecture](./architecture.md) — Technical architecture deep dive
- [AI System](./ai-system.md) — AI architecture, prompts, tools, triggers, memory
- [API Contracts](./api-contracts.md) — 9 API endpoints documented
- [Data Models](./data-models.md) — 13 tables, RLS policies, relationships
- [Source Tree](./source-tree-analysis.md) — Annotated directory structure
- [Component Inventory](./component-inventory.md) — UI components catalog
- [Development Guide](./development-guide.md) — Setup, commands, workflow

## Existing Project Documents

- [PRD.md](../PRD.md) — MVP specification (complete)
- [BUILD_PLAN.md](../BUILD_PLAN.md) — Build roadmap with progress
- [VISION.md](../VISION.md) — Long-term "Skipper AI" product vision
- [CLAUDE.md](../CLAUDE.md) — AI assistant project context
- [README.md](../README.md) — Getting started guide
