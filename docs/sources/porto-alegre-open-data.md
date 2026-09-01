# Source investigation: Portal de Dados Abertos de Porto Alegre

- `id`: not registered — **no connector implemented**.
- Status: investigation only (M10 section 6). Not one of the M9-scope MVP sources (M2/M3/M4:
  Ticketmaster, Destino POA, Prefeitura de Porto Alegre); this note exists so a future
  connector isn't built against an assumption that was never actually verified.

## What was checked

Porto Alegre's official open-data portal states that datasets it publishes may be used,
reused, and redistributed, and exposes them through open APIs/formats. That framing, if it
applies to a specific dataset relevant to cultural events, would be a materially stronger
starting point for `commercialUse` than either Ticketmaster (`restricted`) or Destino POA
(`unknown`) — an explicit reuse license beats no documented terms at all.

## What was deliberately NOT assumed

The Prefeitura de Porto Alegre operates many pages and systems beyond the open-data portal
itself (news pages, department sites, event listings not published as an open dataset). M10
is explicit that **only a dataset actually published through the open-data
portal/open-data source, under its stated license/terms, can be classified as
production-safe** — visiting any `prefeitura.poa` page does not, by itself, place that page's
content under the open-data portal's reuse terms. Conflating "the city government publishes
this somewhere" with "this specific dataset carries an open-data license" would be exactly
the kind of invented authorization the Production Data Gate (ADR-0015) exists to prevent.

## Current classification

No `SourceDefinition` exists for this source — there is nothing to run through
`evaluateProductionGate` yet. Before implementing a connector (a future milestone, M4's
"Prefeitura de Porto Alegre" scope):

1. Identify the *specific dataset(s)* on the open-data portal that carry cultural-event
   information (not a general city-site scrape).
2. Confirm the dataset's own license/terms page states the display of reuse rights that
   apply.
3. Only then register a `SourceDefinition` with `commercialUse: "allowed"` — and only for
   that dataset, not implicitly for every Prefeitura-hosted page.

Until that work happens, any Prefeitura-sourced ingestion stays out of scope, exactly as
CLAUDE.md's "MVP sources" section and M10 section 15 (`Não implementar features explicitamente
excluídas do MVP`) require.
