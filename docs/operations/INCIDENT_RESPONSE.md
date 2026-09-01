# Incident Response

M10 section 51/52 — simple, concrete steps. No paging/on-call tooling is implied or required
by this document; it just answers "what do I actually do."

## Site down (Web unreachable)

1. Check the deploy platform's own status page/dashboard for the Web service.
2. `curl <site>/api/health` — if this itself fails to connect, it's infrastructure
   (DNS/hosting), not application code.
3. Check the platform's logs for the Web process for a crash-loop (M10's own preflight check
   — `docker/web/preflight.mjs` — will crash-loop on purpose if production config is
   invalid; check its stderr first, since that's a self-explanatory error message, not a
   mystery).

## API unhealthy

1. `curl <api>/health` (liveness) then `curl <api>/ready` (readiness — checks DB
   connectivity). A `/health` pass + `/ready` fail means the API process is up but can't
   reach Postgres.
2. Check API logs for the readiness failure's logged error (`request.log.error` on `/ready`
   — real error detail is logged server-side only, never returned in the response body).

## DB unavailable

1. Confirm from the provider's own status/dashboard first — this is very likely
   infrastructure, not application code.
2. If the DB is up but the API can't reach it: check `DATABASE_URL`/network path
   (`PRODUCTION_DATA_SOURCES.md`/`DEPLOYMENT.md`'s private-networking note — a firewall/
   security-group change is a common cause).

## Collector (ingestion) failing

1. `pnpm ops:summary` — check `raw failed` and each source's `raw failed` count.
2. A single connector's normalizer failure never blocks other events (ADR-0006/0007) — a
   spike in one source's `raw failed` is that source's problem, not a systemic outage.
3. Raw payloads are never discarded on failure (ADR-0006) — the failing payload is still in
   `raw_events` with `processing_status='failed'` and `processing_error` populated, so
   diagnosis doesn't require re-fetching from the source.

## Bad event data

There is no admin UI for editing an event (M9/M10 — CLI-only, no admin web). If a specific
event's data is wrong:
- If it came from a fixable source bug (a normalizer defect), fix the normalizer, then
  re-ingest — ingestion is idempotent (M2.1/M3), so re-running is safe.
- If it's a one-off bad manual entry (`manual-beta`), correct the source JSON file and
  re-run `pnpm ingest:manual -- <file>` (idempotent by `id`).
- There is no supported path for editing a `CanonicalEvent` directly in the database as a
  normal operational flow — see CLAUDE.md's ban on ad-hoc data mutation outside the
  ingestion pipeline.

## Wrong dedup suppression (M9/M10 section 52)

Because M9 never performs a destructive merge, this is always reversible:

1. Find the candidate: `pnpm dedup:review:list` shows every `pending_review` candidate; for
   an already-decided pair, query `dedup_candidates` directly by the two event ids (see
   `packages/database/README.md`'s dedup section for the schema) to find its `id`.
2. If a genuinely different pair was wrongly `confirmed_same` (or auto-approved):
   `pnpm dedup:review:different -- <candidate-id>` — this sets
   `status='confirmed_different'`, `decision_source='human'`, and discovery immediately stops
   suppressing either event (no re-scan needed; suppression is computed live from the current
   `dedup_candidates` state on every `GET /v1/events`).
3. Directly editing the database is **not** the normal flow — only use it if the CLI path is
   provably broken, and document what was changed and why.

## Escalation / logs (M10 section 33)

No third-party error-monitoring SaaS is integrated as of M10 (deliberately — "não adicionar
dependência externa sem necessidade", section 33). Logs are consulted directly on whichever
platform hosts the containers (structured JSON logs from Fastify/pino on the API; Next.js's
own stdout/stderr on Web) — record here, once chosen, the actual log-viewing command/URL for
the hosting platform in use.
