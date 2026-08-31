# ADR-0004 — Use Hexagonal Architecture

## Status
Accepted

## Decision
Domain/application logic is isolated from frameworks and providers through ports and adapters.

## Consequences
Source providers, HTTP frameworks and persistence implementations can change without rewriting the domain.
