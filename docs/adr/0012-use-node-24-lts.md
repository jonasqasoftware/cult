# ADR-0012 — Use Node.js 24 LTS

## Status
Accepted

## Context
Node.js 20 is EOL and CULT is a greenfield project with no production deployment yet, so there
is no migration cost to avoid by staying on an older runtime.

## Decision
Node.js 24 LTS (Krypton) is the official runtime for CULT across development, CI and production.
`.nvmrc` pins the exact version; `engines.node` in the root `package.json` constrains installs to
the 24.x line (`>=24.0.0 <25.0.0`) so older EOL runtimes are not silently accepted.

## Consequences
Development, CI and production tooling must use a Node 24.x runtime. `@types/node` tracks the
24.x major version. Upgrading past Node 24 (e.g. to a future LTS) requires a new ADR.
