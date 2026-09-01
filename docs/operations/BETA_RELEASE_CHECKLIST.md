# Beta Release Checklist

## Release states (M10 section 55)

```text
DEV                  — a developer's own machine, docker-compose Postgres, fixtures.
STAGING              — a real deployed environment, noindex'd, fixtures/manual-beta allowed.
TECHNICAL_BETA_READY — the system is deployable/operable; no requirement on WHICH sources
                        back it (fixtures/manual-beta are enough).
PUBLIC_BETA_READY    — TECHNICAL_BETA_READY, PLUS at least one production-safe automated
                        source (or manual-beta judged sufficient for the beta's scope),
                        PLUS every gate below.
```

Do not mark `PUBLIC_BETA_READY` in any document, PR description, or commit message unless
every box below is checked **for real** — a green CI run alone is not sufficient
justification (section 60).

## Checklist

- [ ] CI green on the release commit (lint, typecheck, migrations, unit/integration tests,
      build, fixture ingestion, E2E) — `gh run list` / `gh run view`.
- [ ] `pnpm db:migrate` run against the target environment (never a destructive schema push).
- [ ] Production Data Gate: `pnpm sources:production-status` shows at least one `APPROVED`
      source with real (non-synthetic) content, OR an explicit, documented decision that
      `manual-beta` alone is sufficient for this beta's scope — see
      `PRODUCTION_DATA_SOURCES.md`.
- [ ] Backup: `BACKUP_AND_RESTORE.md`'s checklist fully answered for the actual hosting
      provider in use (not left as a template).
- [ ] Health/readiness: `/health`, `/ready` (API), `/api/health` (Web) all verified reachable
      from the deploy platform's own health-check mechanism.
- [ ] Web: builds and serves via `docker/web/Dockerfile` (or equivalent), `CULT_ENV=production`
      config validated (`assertProductionConfig` / `docker/web/preflight.mjs`).
- [ ] API: builds and serves via `docker/api/Dockerfile`, private-network-only if the
      platform supports it (never reachable directly from the browser).
- [ ] `pnpm dedup:scan` run at least once against real ingested data; `pnpm ops:summary` and
      `pnpm dedup:review:list` show a sane, reviewed state (no unexpected pending-review
      backlog for launch content).
- [ ] SEO: `robots.ts` confirmed `noindex` in staging, indexable (home + event details only)
      in production; `sitemap.ts` returns real event URLs.
- [ ] `/privacidade` and `/sobre` pages reachable and reviewed for factual accuracy against
      the actual launch configuration (e.g. if analytics is disabled, the privacy page should
      not overclaim what it collects).
- [ ] Smoke: `pnpm e2e` (or the BASE_URL-configurable smoke suite, `e2e/tests/smoke.spec.ts`)
      run against the actual staging/production deployment, not just CI's local stack.
- [ ] Rollback procedure understood (`DEPLOYMENT.md` "Migrations" section) — not necessarily
      exercised, but documented and read by whoever is deploying.
- [ ] Dependency/security audit (`pnpm audit` + `SECURITY_AUDIT.md`) reviewed — no
      known-critical, fixable vulnerability shipped unaddressed.
- [ ] Known gaps from the M10 final report reviewed and accepted by whoever approves the
      release (not silently ignored).

## Explicit non-goals (M10 section 56 — do not build these to satisfy this checklist)

Admin web, user accounts, favorites, recommendations, ML/AI, notifications, a new ranking
algorithm, destructive dedup merge, full-cluster (transitive) dedup, a producer dashboard,
payments. None of these block Public Beta readiness; none should be added under the guise of
"finishing" this checklist.
