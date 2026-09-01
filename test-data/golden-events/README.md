# Golden Events Dataset

Store controlled source fixtures and expected canonical output here.

```text
test-data/golden-events/
  ticketmaster/              implemented (M2/M2.1)
  destino-poa/                implemented (M3)
  prefeitura-poa/              not implemented yet (M4)
  cross-source-candidates.md   dedup candidate pairs — documented only, no matching (M3)
```

Include cases for:
- exact duplicates;
- fuzzy duplicates (see `cross-source-candidates.md`);
- recurring events;
- rescheduled events;
- cancelled events;
- missing price;
- missing image;
- venue spelling variants.
