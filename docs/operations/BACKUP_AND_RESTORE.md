# Backup and Restore

M10 section 16 is explicit: do not claim backup exists just because the hosting provider
offers managed PostgreSQL. This document must be filled in with the **actual, verified**
configuration of whichever provider hosts the production database — it is written here as a
checklist/template, not as a claim that backups are currently configured.

## What must be answered before Public Beta is READY

- [ ] Which provider hosts the production PostgreSQL instance?
- [ ] Does that provider perform automatic backups? At what frequency (continuous WAL
      archiving, daily snapshot, ...)?
- [ ] What is the retention window for those backups?
- [ ] Has a **restore** actually been tested (not just "the provider says it supports it")?
      Record the date, who ran it, and against which environment (never restore-test against
      production).
- [ ] Is there a documented, executable restore procedure specific to this provider (console
      steps or CLI commands), not just "contact support"?
- [ ] Who is responsible for verifying backups are still running, and how often is that
      checked?

## Minimum manual fallback (works on any provider, until the above is answered)

```bash
pg_dump "$DATABASE_URL" \
  --format=custom \
  --file="cult-backup-$(date +%Y%m%d-%H%M%S).dump"
```

Restore into a **different, empty** database first to verify the dump is valid before ever
restoring into production:

```bash
createdb cult_restore_test
pg_restore --dbname=cult_restore_test cult-backup-*.dump
```

This manual fallback is not a substitute for a provider-level backup policy — it has no
automated schedule and depends on someone remembering to run it.

## What is explicitly NOT backed up / not needed

- Raw event payloads for a `restricted`/`unknown`-`commercialUse` source may carry their own
  retention limits (ADR-0013, `retention_until`) — a backup must not become a mechanism for
  retaining data past what a source's terms allow. Any restore procedure should re-check
  `retention_until` after restoring.
- `analytics_events` (M10) contains no personal data (see `PRIVACY.md`/the `/privacidade`
  page) — losing it is a product-metrics gap, not a data-loss incident requiring user
  notification.
