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
  worker/   Ingestion worker — Ticketmaster fixture/live ingestion commands (M2)

packages/
  domain/             M1 — entities, ports, source registry (provider-independent)
  database/           M2 — Drizzle schema, migrations, repositories (Ticketmaster slice)
  connectors/         M2 — Ticketmaster client/adapter/normalizer (see docs/sources/)
  canonical-events/   M2 — slug generation, provisional quality/ranking score policy
  config/             M2 — env loading, Source Registry (Ticketmaster: commercialUse=restricted)
  deduplication/      M5 — dedup logic (not started)
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
pnpm ingest:ticketmaster           # requires TICKETMASTER_API_KEY in .env; never used in CI
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
via `docker/postgres/initdb/001-extensions.sql` (see ADR-0005). Schema/migrations for the
Ticketmaster vertical slice (`sources`, `raw_events`, `events`, `event_occurrences`,
`event_sources`, `venues`) live in `packages/database/drizzle/` — no domain tables beyond
what M2 needs (see ADR-0013 for `raw_events.retention_until`).
