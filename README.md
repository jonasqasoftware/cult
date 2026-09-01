# CULT

Private monorepo for CULT — a cultural discovery and intelligence platform.

## MVP 1

Porto Alegre Cultural Discovery.

### Goal

Aggregate, normalize, deduplicate and rank cultural events from selected sources, then expose them through a mobile-first Web/PWA experience.

### First milestone

Do not start with UI.

First vertical slice:

```text
Ticketmaster
    ↓
Raw Event
    ↓
Normalizer
    ↓
Canonical Event
    ↓
PostgreSQL
    ↓
GET /v1/events
```

See:
- `docs/product/CULT_MVP1_Technical_Specification.md`
- `CLAUDE.md`
- `docs/adr/`
- `openapi/cult-api.yaml`

## Monorepo layout

```text
apps/
  api/      Fastify REST API — /health, /ready, GET /v1/events, GET /v1/events/{slug}
  web/      Next.js Web/PWA (placeholder page only — no product UI yet)
  worker/   Ingestion worker — Ticketmaster + Destino POA fixture ingestion commands

packages/
  domain/             M1/M4 — entities, ports, source registry; EventOccurrence is a
                        discriminated union (timed | date-only) — see ADR-0014
  database/           M2 — Drizzle schema, migrations, repositories (multi-source, no dedup)
  connectors/         M2/M3 — Ticketmaster + Destino POA client/adapter/normalizer
  canonical-events/   M2/M3 — slug gen, content hash, provisional score policy (shared)
  config/             M2/M3 — env loading, Source Registry (see docs/sources/*.md for legal status)
  deduplication/      M5 — dedup logic (not started — see test-data/golden-events/cross-source-candidates.md)
  ranking/            future — real quality score / ranking logic (not started)
  observability/      future — structured logging, ingestion metrics (not started)
```

`deduplication`, `ranking` and `observability` remain empty M0 scaffolds — no logic yet.

## Requirements

- Node.js 24.x (see `.nvmrc`) — Node 20 is EOL, see ADR-0012
- pnpm (via `corepack enable`)
- Docker + Docker Compose (for PostgreSQL/PostGIS)

## Getting started

```bash
corepack enable
pnpm install

# start PostgreSQL + PostGIS + pg_trgm
pnpm db:up

# apply the Drizzle migrations (sources, raw_events, events, event_occurrences,
# event_sources, venues — see packages/database/drizzle/)
pnpm db:migrate

cp .env.example .env
```

## Development

```bash
pnpm dev:api      # Fastify API on http://localhost:3001 (/health, /ready, /v1/events)
pnpm dev:web      # Next.js app on http://localhost:3000
pnpm dev:worker   # worker foundation entrypoint

# Ticketmaster ingestion (see docs/sources/ticketmaster.md)
pnpm ingest:ticketmaster:fixture   # no API key / no network — reads the synthetic fixture
pnpm ingest:ticketmaster           # requires TICKETMASTER_API_KEY + TICKETMASTER_LIVE_PERSIST_ACK=true
pnpm ingest:ticketmaster:live-smoke  # bounded, read-only, never persists

# Destino POA ingestion (see docs/sources/destino-poa.md) — fixture-only, no live-persisting
# command exists yet (commercialUse: unknown, HTML-scraped — see ADR-0013)
pnpm ingest:destino-poa:fixture    # no network — reads the synthetic fixture
pnpm inspect:destino-poa           # bounded, read-only live discovery spike, never persists
```

## Quality checks

```bash
pnpm lint         # ESLint across the workspace
pnpm format       # Prettier write
pnpm format:check # Prettier check
pnpm typecheck    # TypeScript strict, project references
pnpm test         # Vitest across apps/packages
pnpm build        # Build all packages/apps
```

## Database

```bash
pnpm db:up        # start postgres (postgis/postgis image) via Docker Compose
pnpm db:down      # stop it
pnpm db:generate  # regenerate Drizzle migrations from packages/database/src/schema.ts
pnpm db:migrate   # apply pending migrations (requires DATABASE_URL)
```

`docker-compose.yml` provisions PostgreSQL with the `postgis` and `pg_trgm` extensions enabled
via `docker/postgres/initdb/001-extensions.sql` (see ADR-0005). Schema/migrations
(`sources`, `raw_events`, `events`, `event_occurrences`, `event_sources`, `venues`) live in
`packages/database/drizzle/` and are already multi-source (proven by Ticketmaster + Destino
POA coexisting) — no schema change was needed to add the second provider, and no dedup table
exists yet (see ADR-0013 for `raw_events.retention_until`). `event_occurrences` supports both
a precise `timed` row and a date-only/ranged `date` row (`temporal_kind`, enforced by CHECK
constraints) — see ADR-0014.
