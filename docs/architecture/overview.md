# CULT MVP 1 — Architecture Overview

## Context

CULT aggregates fragmented cultural event information and turns it into one canonical catalogue.

## Architectural principle

The user interface is replaceable.

The core asset is:

```text
Source Network
+
Raw Event Store
+
Canonical Event Model
+
Deduplication
+
Data Quality
+
Ranking
```

## Bounded modules

- ingestion
- sources
- events
- venues
- organizers
- performers
- categories
- deduplication
- ranking
- admin
- discovery

## Dependency direction

```text
Adapters → Application → Domain
```

Domain must not depend on infrastructure.

## External integrations

Every provider gets its own adapter.

Example:

```text
EventSourcePort
   ↑
TicketmasterAdapter
DestinoPOAAdapter
PrefeituraPOAAdapter
```

## First vertical slice

```text
TicketmasterAdapter
        ↓
RawEventRepository
        ↓
TicketmasterNormalizer
        ↓
CanonicalEvent
        ↓
EventRepository
        ↓
GET /v1/events
```
