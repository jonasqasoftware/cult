# ADR-0006 — Preserve raw source events

## Status
Accepted

## Decision
Every source payload is persisted before normalization.

## Consequences
Parsers can be repaired and data reprocessed without refetching the source.
