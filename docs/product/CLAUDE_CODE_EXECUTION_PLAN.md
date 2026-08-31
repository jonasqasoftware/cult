# CULT — Claude Code Execution Plan

Use this file as the implementation order.

## Rule
Execute one milestone at a time. Do not silently advance to the next milestone.

## M0 — Foundation

### Goal
Create a healthy monorepo with no product logic.

### Deliverables
- pnpm workspace
- apps/api
- apps/web
- apps/worker
- packages/domain
- packages/database
- packages/connectors
- packages/canonical-events
- packages/deduplication
- packages/ranking
- packages/config
- packages/observability
- TypeScript strict
- ESLint
- Prettier
- Vitest
- Docker Compose
- PostgreSQL + PostGIS
- basic CI
- health skeletons
- README commands

### Acceptance
- `pnpm install`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
all pass.

## M1 — Domain

### Goal
Define provider-independent contracts.

### Implement
- Event
- EventOccurrence
- Venue
- Organizer
- Performer
- Category
- SourceDefinition
- RawSourceEvent
- EventSourcePort
- repositories as ports

### Acceptance
No framework imports inside domain package.

## M2 — Ticketmaster Vertical Slice

### Goal
Make first real event flow end-to-end.

### Implement
- TicketmasterAdapter
- Ticketmaster fixtures
- raw_events migration
- normalizer
- canonical events migration
- ingestion job
- `GET /v1/events`

### Acceptance
A real or fixture Ticketmaster event can be collected, stored raw, normalized, persisted and returned by the API.

## M3 — Destino POA
Same pipeline, new adapter.

## M4 — Prefeitura POA
Same pipeline, new adapter.

## M5 — Deduplication

### Goal
Multiple source events can resolve to one canonical event.

### Acceptance
Golden Dataset regression passes.

## M6 — Discovery API

Implement:
- q
- category
- date window
- free
- proximity
- cursor pagination

## M7 — Web/PWA

Implement:
- Home
- Event list
- Filters
- Event detail
- Share
- Maps link
- MapLibre view
- PWA manifest
- Schema.org/Event

## M8 — Admin

Implement:
- Source health
- Duplicate review
- Reprocess failures
- Minimal event correction

## M9 — Beta

Deploy staging, seed real data, onboard first users and measure product metrics.
