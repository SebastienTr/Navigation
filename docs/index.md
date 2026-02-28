# Bosco — Documentation Index

**Generated:** 2026-02-28 | **Scan Level:** Exhaustive

## Generated Documentation

| Document | Description | Focus |
|----------|-------------|-------|
| [Project Overview](./project-overview.md) | Executive summary, metrics, tech stack, implementation status | Entry point |
| [Architecture](./architecture.md) | Technical architecture, rendering strategy, auth flow, state management, deployment | Architecture |
| [AI System](./ai-system.md) | **Deep dive** — Prompts, tools, agentic loop, triggers, memory, route proposals | AI (Focus Area) |
| [API Contracts](./api-contracts.md) | 9 API endpoints with request/response shapes, auth, SSE events | API |
| [Data Models](./data-models.md) | 13 tables, column definitions, RLS policies, indexes, migration history | Database |
| [Source Tree](./source-tree-analysis.md) | Annotated directory structure with line counts and file purposes | Structure |
| [Component Inventory](./component-inventory.md) | 8 shared components, 12 page components, hooks, UI patterns | Frontend |
| [Development Guide](./development-guide.md) | Setup, environment, scripts, conventions, deployment, troubleshooting | DevOps |

## Existing Project Documents

| Document | Description | Location |
|----------|-------------|----------|
| [PRD.md](../PRD.md) | MVP specification — complete product requirements | Project root |
| [BUILD_PLAN.md](../BUILD_PLAN.md) | Sequenced 6-phase build roadmap with progress tracking | Project root |
| [VISION.md](../VISION.md) | Long-term "Skipper AI" product vision (BYOAI, freemium) | Project root |
| [CLAUDE.md](../CLAUDE.md) | AI assistant project context and coding conventions | Project root |
| [README.md](../README.md) | Getting started guide | Project root |

## Reading Order

### For a new developer
1. **[Project Overview](./project-overview.md)** — What is this and how big is it
2. **[Architecture](./architecture.md)** — How it's built
3. **[Development Guide](./development-guide.md)** — How to run it
4. **[Source Tree](./source-tree-analysis.md)** — Where things are
5. **[Data Models](./data-models.md)** — Database structure

### For understanding the AI system
1. **[AI System](./ai-system.md)** — Complete deep dive (start here)
2. **[API Contracts](./api-contracts.md)** — Chat and briefing endpoints
3. **[Data Models](./data-models.md)** — ai_memory, chat_history, briefings tables

### For frontend work
1. **[Component Inventory](./component-inventory.md)** — What components exist
2. **[Source Tree](./source-tree-analysis.md)** — Page file locations
3. **[Architecture](./architecture.md)** — Rendering strategy, state management

## Scan Metadata

| Property | Value |
|----------|-------|
| Scan level | Exhaustive (all source files read) |
| Source files scanned | 63 TypeScript/TSX |
| SQL migrations scanned | 6 |
| Config files scanned | 12 |
| Total lines analyzed | ~17,000+ |
| Documents generated | 8 |
| State file | [project-scan-report.json](./project-scan-report.json) |
