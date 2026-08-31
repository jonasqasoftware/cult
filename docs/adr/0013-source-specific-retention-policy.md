# ADR-0013 — Source-specific retention policy for raw payloads

## Status
Accepted

## Context
ADR-0006 established that every source payload is persisted before normalization and is never
discarded due to parser or normalization failure. That rule was written without considering
that individual sources may carry legal/licensing terms that restrict how long their content
may be stored. Ticketmaster's Discovery API terms, for example, restrict indefinite
storage/caching of Event Content and require the ability to remove content on request (see
[docs/sources/ticketmaster.md](../sources/ticketmaster.md)).

## Decision
Raw payloads are preserved for as long as permitted by the terms/license of their source, not
indefinitely by default. `raw_events` gains a `retention_until` column (nullable timestamp).
ADR-0006's "never discard raw payloads" rule is not reversed by this ADR — it still governs
*why* a payload is discarded (never due to processing failure) — but is refined to mean:

```text
preserve the raw payload for as long as legally/licence permitted,
not "discard on failure", and not "retain forever" when a source's terms say otherwise.
```

A `NULL` (or unset) `retention_until` means no retention limit has been configured yet — it
must never be treated as "forever" by application code. For Ticketmaster specifically, no
production retention duration is set in M2; it stays a technical capability, blocked on legal/
commercial review, until a real value is decided and documented in
`docs/sources/ticketmaster.md`.

## Consequences
- Every source's registry entry and source documentation should state its retention posture
  once known.
- Application code (e.g. a future cleanup job) must treat `retention_until IS NULL` as "not yet
  decided," never as permission to keep data forever.
- CULT must never violate a source's terms to satisfy an internal architectural preference
  (e.g. wanting one uniform retention rule across all sources).
- Fixture/synthetic data used in tests is not real Event Content and is not subject to this
  policy.
