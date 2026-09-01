# Deployment

## Environment model (M10 section 9)

`CULT_ENV` (not `NODE_ENV`, which frameworks also set/read for unrelated build-mode reasons)
is one of `development | test | staging | production`, validated at process startup
(`packages/config/src/env.ts`'s `loadAppEnv`) — an invalid value throws immediately rather
than silently defaulting.

- **development** — a developer's own machine. Fixtures, `docker-compose.yml`'s local
  Postgres, no production config requirements.
- **test** — CI and local test runs. Same as development for config purposes.
- **staging** — a real, deployed environment (its own DB, its own URLs), but explicitly
  allowed to run on fixtures/synthetic or `manual-beta` data (M10 section 2: TECHNICAL
  STAGING vs PUBLIC BETA). `noindex`d (see robots.ts).
- **production** — the only environment where `assertProductionConfig()` enforces required
  vars and rejects `localhost`/`127.0.0.1`, and where the Production Data Gate
  (`PRODUCTION_DATA_SOURCES.md`) actually blocks a source's live ingestion.

## Architecture

Unchanged from CLAUDE.md's Modular Monolith: no microservices, no Kubernetes, no message
broker. Four deployable units:

```text
Web (Next.js, apps/web)      — public, serves the PWA + its own small BFF routes
API (Fastify, apps/api)      — PRIVATE. Reachable only from Web server-side, never the browser
Worker (CLI, apps/worker)    — invoked on-demand/by cron for ingestion, dedup:scan, ops
PostgreSQL + PostGIS/pg_trgm — one database, reachable only from API/Worker
```

If the hosting provider supports private networking, place the API on a private
network/subnet reachable only by Web and Worker — the browser must never be able to reach it
directly (M8 section 7 restated for beta: this stays true, no new public API surface was
added for M10 beyond `POST /v1/analytics`, itself only called server-side by Web's own
`/api/analytics` BFF route).

## Containers (M10 section 13)

`docker/{api,web,worker}/Dockerfile` — multi-stage, Node 24, non-root (`cult` user), only
production dependencies + compiled output shipped (no devDependencies, no TypeScript
source... `apps/api`/`apps/worker` currently also carry their own `src/` alongside `dist/`,
a known minor size optimization not chased in M10 — see `packages/*/README.md` "Limitations"
notes for the pattern). Build from the repo root, e.g.:

```bash
docker build -f docker/api/Dockerfile -t cult-api .
docker build -f docker/worker/Dockerfile -t cult-worker .
docker build -f docker/web/Dockerfile -t cult-web \
  --build-arg CULT_API_BASE_URL=https://api.internal \
  --build-arg NEXT_PUBLIC_SITE_URL=https://cult.example.com .
```

`NEXT_PUBLIC_*` values are inlined into the client bundle at build time by Next.js — a real
deployment builds one Web image per target site URL, not one image reused across
environments by only changing runtime env vars for those two.

### Two non-obvious things this milestone found by actually running each image (not just
writing the Dockerfile — see M10 section 58)

1. **Next's standalone tracer (`@vercel/nft`) does not follow the `node_modules/@cult/*`
   symlinks pnpm creates for `workspace:*` packages living outside `node_modules`.**
   `apps/web`'s `.next/standalone` output silently omitted `@cult/config`/`@cult/domain`
   entirely. Fixed via `next.config.mjs`'s `outputFileTracingIncludes` (forces their `dist/`
   output into the trace) plus the web Dockerfile manually recreating the
   `node_modules/@cult/{config,domain}` symlinks and copying each package's `package.json`
   (tracing brought the `dist/` files but not the manifest Node needs to resolve `main`).
2. **`instrumentation.ts`'s compiled hook is not included in standalone output at all**
   (it's a root-level Next.js hook, not something any route imports, so the tracer never
   sees it) — Next's own standalone `server.js` silently skips loading a missing
   instrumentation file, with no error. Worse: even once copied in and correctly detecting
   an invalid production config, an instrumentation-hook failure inside Next's standalone
   server is logged as an unhandled rejection but does **not** exit the process — it keeps
   listening and answers every request, including `/api/health`, with a 500. The real
   fail-closed gate is `docker/web/preflight.mjs`, run as a separate step
   (`node preflight.mjs && node apps/web/server.js`) in the image's `CMD` — it calls the
   exact same `assertProductionConfig()` but as a standalone process that genuinely exits
   non-zero before the server ever starts listening.

Both were caught only because this milestone actually built and ran each image with
`CULT_ENV=production` and a deliberately-invalid config, per section 58's requirement — not
by reasoning about what the Dockerfile "should" do.

## Migrations (M10 section 15)

`pnpm db:migrate` is a mandatory, explicit step before releasing a new version — never run
automatically as a side effect of application startup. Migrations are additive/forward-only
(`packages/database/drizzle/*.sql`, Drizzle-generated); nothing in this codebase performs a
destructive schema push.

**Rollback**: there is no automated down-migration tooling. If a bad migration ships:
1. Stop the deploy (do not route traffic to the new version).
2. Write and apply a new, forward migration that reverses the change (e.g. drop a column a
   previous migration added) — never hand-edit a previously-applied migration file.
3. If data was written under the bad schema, decide case-by-case whether it needs cleanup;
   there is no generic automated data-rollback path (see `BACKUP_AND_RESTORE.md` for a
   full-database restore as the last resort).

## Health / readiness (M10 section 14)

- API: `GET /health` (liveness), `GET /ready` (checks DB connectivity).
- Web: `GET /api/health` (liveness only — never depends on the private API or an event
  detail page, so Web's own health never fails because of an unrelated API/DB outage).

## Dedup scan scheduling (M10 section 39)

No scheduler is built into CULT — use the deployment environment's own cron/scheduler to run,
after each ingestion:

```bash
pnpm dedup:scan
```

(or, from a built image: `docker run --rm cult-worker node apps/worker/dist/commands/dedup-scan.js`)

A reasonable cadence: run `dedup:scan` immediately after each source's ingestion completes,
since scanning is what turns freshly-ingested duplicate candidates into a routed decision.

## Deploy smoke (M10 section 47)

After every deploy, check in order:

```text
GET /health              (API)
GET /ready                (API)
GET /                     (Web)
GET /manifest.webmanifest (Web)
GET /v1/events            (API, from a private network position — never from the public internet)
GET /eventos/<a-real-slug> (Web)
```
