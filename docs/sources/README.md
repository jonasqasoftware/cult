# Source Documentation

Per-source documentation (terms of use, retention, rate limits, field mapping notes) as
connectors land.

- [`ticketmaster.md`](ticketmaster.md) — implemented (M2/M2.1). `commercialUse: restricted`. Production: **BLOCKED** (ADR-0015).
- [`destino-poa.md`](destino-poa.md) — implemented, fixture-only (M3). `commercialUse: unknown`. Production: **BLOCKED** (ADR-0015).
- [`manual-beta.md`](manual-beta.md) — implemented (M10). `commercialUse: allowed`. Production: **APPROVED** (ADR-0015) — the beta fallback source; see M10's Production Data Gate.
- [`porto-alegre-open-data.md`](porto-alegre-open-data.md) — investigation only (M10), no connector. Prefeitura POA (M4 scope) remains not implemented.

Run `pnpm sources:production-status` for the current, authoritative gate state of every
registered source.
