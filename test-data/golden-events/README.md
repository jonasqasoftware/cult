# Golden Events Dataset

Store controlled source fixtures and expected canonical output here.

```text
test-data/golden-events/
  ticketmaster/              implemented (M2/M2.1)
  destino-poa/                implemented (M3)
  prefeitura-poa/              not implemented yet (M4)
  deduplication/               cross-source dedup ground truth (M5) — see its own README.md
  cross-source-candidates.md   superseded by deduplication/ (kept for history — see that file)
```

Per-source connector fixtures (`ticketmaster/`, `destino-poa/`) cover normalizer edge cases:
exact duplicates within one source's own re-ingestion, recurring events, rescheduled events,
cancelled events, missing price, missing image, venue spelling variants.

Cross-source deduplication ground truth — same title across two providers, fuzzy venue
matches, ambiguous cases — lives in `deduplication/`, not here. See
`deduplication/README.md` for the full truth-vs-routing model, label change policy and how
the future Deduplication Engine (M6+) should consume it.
