# CLAUDE.md — CULT

## Product

CULT is a proprietary cultural discovery and intelligence platform.

Current scope:
**MVP 1 — Porto Alegre Cultural Discovery**

Primary user problem:
Cultural event information is fragmented across many sources.

Primary product goal:
Make it faster and easier to discover what to do in Porto Alegre.

## Current architecture

- Modular Monolith
- Hexagonal Architecture / Ports & Adapters
- TypeScript strict
- Next.js Web/PWA
- Fastify API
- PostgreSQL + PostGIS + pg_trgm
- Drizzle ORM
- REST + OpenAPI
- Worker-based ingestion pipeline

## Repository policy

This is a proprietary/private product.

Do not:
- publish source code;
- expose internal connectors;
- expose secrets;
- expose unrestricted internal APIs;
- move proprietary scoring logic to client-side code.

## Mandatory engineering rules

1. Domain code must not depend on Fastify, Next.js, Drizzle, HTTP clients, or external SDKs.
2. External sources are adapters behind ports.
3. Frontend must never call third-party event providers directly.
4. Every ingested source payload must be stored in Raw Event Store before normalization.
5. Ingestion must be idempotent.
6. Provenance must be preserved for every canonical event.
7. Never discard raw payloads due to parser or normalization failure.
8. New DB changes require migrations.
9. TypeScript must run with `strict: true`.
10. New source connectors require:
   - source definition;
   - fixtures;
   - normalizer tests;
   - contract tests;
   - error handling;
   - rate limit awareness.
11. Deduplication thresholds are product logic and must be tested.
12. Do not introduce new infrastructure without an ADR.
13. Do not introduce microservices in MVP 1.
14. Do not introduce Kafka in MVP 1 unless an ADR demonstrates a concrete need.
15. Do not build features explicitly excluded from MVP.
16. Do not implement payments or ticket checkout in MVP 1.
17. Do not require login for discovery.
18. Location permission must be requested only after explicit user intent.
19. Administrative actions must be authorized server-side.
20. API contract must stay synchronized with `openapi/cult-api.yaml`.

## MVP sources

Initial planned sources:
1. Ticketmaster
2. Destino POA
3. Prefeitura de Porto Alegre

Do not add additional production connectors without explicit scope change.

## Canonical ingestion pipeline

```text
Source
  ↓
Collect
  ↓
Persist Raw Event
  ↓
Validate
  ↓
Normalize
  ↓
Enrich
  ↓
Deduplicate
  ↓
Quality Score
  ↓
Canonical Event
  ↓
Ranking
```

## Domain entities

Core:
- Event
- EventOccurrence
- Venue
- Organizer
- Performer
- Category
- Source
- SourceEvent
- RawEvent
- DuplicateCandidate
- IngestionRun

## Event statuses

Allowed:
- scheduled
- cancelled
- postponed
- rescheduled
- completed

Do not invent additional statuses without updating the domain contract and OpenAPI.

## API MVP

Only these endpoints are required initially:

- `GET /health`
- `GET /ready`
- `GET /v1/events`
- `GET /v1/events/{slug}`
- `GET /v1/categories`

Do not add operation-style endpoints such as:
- `/getEvents`
- `/findAll`
- `/searchEvents`

Use resource-oriented REST.

## Errors

Use RFC 9457-style Problem Details.

Content type:
`application/problem+json`

## Pagination

Use cursor pagination for event lists.

Avoid deep offset pagination.

## Raw Event Store

Minimum fields:
- id
- source_id
- external_id
- source_url
- payload_json
- content_hash
- fetched_at
- processing_status
- processing_error
- schema_version

## Deduplication

Two phases:

1. Deterministic
2. Similarity-based

Do not silently merge uncertain duplicates.

Uncertain candidates go to review.

## Quality score

Must be deterministic and explainable in MVP 1.

No ML model.

## Ranking

Must be deterministic and explainable in MVP 1.

No personalized recommendation model.

## Testing

Required:
- unit tests for normalizers;
- unit tests for dedup;
- unit tests for quality score;
- unit tests for ranking;
- integration tests for DB;
- connector contract fixtures;
- minimal Playwright E2E.

## Golden Dataset

Use `test-data/golden-events`.

Never modify golden expected results simply to make a failing implementation pass unless the business rule itself changed and the change is documented.

## Security

Never:
- expose provider secrets to browser;
- store secrets in repository;
- trust external HTML or JSON;
- fetch arbitrary remote URLs without validation;
- log credentials.

## Observability

Every ingestion run should eventually expose:
- source
- start
- finish
- count discovered
- count normalized
- count failed
- count created
- count updated
- duplicate candidates

## Working with this repository

Before implementing a new architectural approach:
1. inspect existing ADRs;
2. inspect this file;
3. inspect the technical specification;
4. create/update ADR if necessary;
5. implement the smallest coherent change;
6. run tests and checks.

## Current execution order

Do not jump ahead.

1. M0 Foundation
2. M1 Domain
3. M2 Ticketmaster vertical slice
4. M3 Destino POA
5. M4 Prefeitura POA
6. M5 Deduplication
7. M6 Discovery API
8. M7 Web/PWA
9. M8 Admin
10. M9 Beta

## Definition of Done

A task is not done until:
- lint passes;
- typecheck passes;
- tests pass;
- build passes;
- migrations are included when needed;
- OpenAPI is updated when API changed;
- docs/ADR are updated when architecture changed.
