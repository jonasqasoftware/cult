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
  api/      Fastify REST API (health/ready skeleton only in M0)
  web/      Next.js Web/PWA (placeholder page only in M0)
  worker/   Ingestion worker (no jobs scheduled in M0)

packages/
  domain/             M1 — entities, ports, source registry
  database/            M1/M2 — Drizzle schema, migrations, repositories
  connectors/          M2 — source adapters
  canonical-events/    M2 — normalization
  deduplication/       M5 — dedup logic
  ranking/             quality score / ranking logic
  config/              shared env/config loading
  observability/       structured logging, ingestion metrics
```

All `packages/*` are empty scaffolds in M0 — no domain, connector or product logic yet.

## Requirements

- Node.js >= 20
- pnpm (via `corepack enable`)
- Docker + Docker Compose (for PostgreSQL/PostGIS)

## Getting started

```bash
corepack enable
pnpm install

# start PostgreSQL + PostGIS + pg_trgm
pnpm db:up

cp .env.example .env
```

## Development

```bash
pnpm dev:api      # Fastify API on http://localhost:3001 (/health, /ready)
pnpm dev:web      # Next.js app on http://localhost:3000
pnpm dev:worker   # worker foundation entrypoint
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
```

`docker-compose.yml` provisions PostgreSQL with the `postgis` and `pg_trgm` extensions enabled
via `docker/postgres/initdb/001-extensions.sql` (see ADR-0005). No application schema/migrations
exist yet — those land in M1/M2 with `packages/database`.
