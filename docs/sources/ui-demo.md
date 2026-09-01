# Source: UI Demo Dataset (development/demo only)

- `id`: `ui-demo`
- `type`: `manual`
- `commercialUse`: `restricted` (never `allowed` — see "Why `restricted`" below)
- Composition: `apps/worker/src/demo-seed.ts` (reuses `packages/connectors/src/manual/`)
- Seed command: `pnpm demo:seed`
- Reset command: `pnpm demo:reset`

## What this is

M10.2's answer to a real problem: the golden fixtures (Ticketmaster/Destino POA/manual-beta)
exist to validate normalization, the temporal model, dedup, and the broken-image fallback —
never to look good. Most of their events carry `example.invalid` image URLs on purpose (see
`docs/quality/UI_DEMO_DATASET.md`), which makes the Home page look like an unfinished
scaffold during manual UI/UX review. `ui-demo` is a second, entirely separate dataset built
only to let a human open the app locally and judge the actual visual product with realistic,
varied, but 100% fictional content.

This is not a production data source, was never meant to become one, and is not a
relaxation of any other source's licensing — see "Why `restricted`" below.

## Full guide

See `docs/quality/UI_DEMO_DATASET.md` for what's in the dataset, how to seed/reset it, and how
to review it. This file only covers the source-registry/production-gate side, matching the
per-source documentation convention every other connector already follows.

## Why `commercialUse: restricted` (not `allowed`, unlike manual-beta)

Every event in `test-data/ui-demo/events.json` is entirely invented — fictional venues,
fictional organizers, fictional descriptions, original CULT-made SVG cover art (never a
third-party photo). There is no real rights question to resolve for fictional content, so
`restricted`/`unknown` here is not really about commercial/legal review the way it is for
Ticketmaster or Destino POA. It is used anyway, deliberately, purely so this source is routed
through the exact same `evaluateProductionGate` mechanism (ADR-0015) that blocks any other
unapproved source — `ui-demo` must never reach production, permanently, by design, and
`commercialUse: allowed` is the one value that would let it slip through that gate. Never
change this to `allowed`.

## Two independent production guards (belt and suspenders)

1. `pnpm demo:seed` (`apps/worker/src/commands/demo-seed.ts`) refuses to run at all when
   `CULT_ENV=production` — the very first thing it checks, before opening a database
   connection. Verified directly: `CULT_ENV=production pnpm demo:seed` exits non-zero with a
   clear message and touches no data.
2. `checkProductionSourceAllowed` (the same fail-closed gate every other ingestion command
   uses) would also block it, via `UI_DEMO_SOURCE_DEFINITION`'s `commercialUse`, as a second,
   independent layer — same pattern as `ingest-ticketmaster-live.ts`'s ACK + gate.

## Ingestion pipeline

The same composition root as every other connector —
`RawSourceEvent -> normalize -> CanonicalEvent` via `runIngestion`
(`apps/worker/src/run-ingestion.ts`). `demo-seed.ts` reuses
`packages/connectors/src/manual/`'s own `manualEventToRawSourceEvent` and
`normalizeManualEvent` unchanged, under the distinct `ui-demo` source id (see
`manual-file-adapter.ts`'s `sourceId` parameterization) — not a fork of the manual connector,
not a new normalizer. Nothing is inserted directly into `events`; raw-store/provenance
guarantees (ADR-0006) hold exactly as they do for every other source.

## Idempotency

Every demo event's canonical id is deterministic (`ui-demo-<external id>`, e.g.
`ui-demo-jazz-ao-entardecer`), and `canonicalEventRepository.save` (inside `runIngestion`)
upserts by id — running `pnpm demo:seed` again updates the same 10 rows, never duplicates
them. Verified directly, twice in a row (`canonicalSaved: 10` both times).

## Reset

`pnpm demo:reset` deletes only canonical events whose id starts with `ui-demo-` — this prefix
is deterministic and can never match a golden fixture, `manual-beta`, or any other source's
event. The FK cascade (`event_occurrences`/`event_sources`/`dedup_candidates` -> `events`)
removes everything tied to them. `raw_events` for `source_id = "ui-demo"` are deliberately left
alone: the Raw Event Store is a permanent audit trail by design (ADR-0006), even for demo
data — there's no reason to special-case it out of that.

## Retention

No retention restriction applies (ADR-0013's `retention_until` stays unset) — there is no
real-world content whose retention terms matter here.
