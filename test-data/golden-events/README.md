# Golden Events Dataset

Store controlled source fixtures and expected canonical output here.

Recommended structure:

```text
test-data/golden-events/
  ticketmaster/
  destino-poa/
  prefeitura-poa/
  expected/
```

Include cases for:
- exact duplicates;
- fuzzy duplicates;
- recurring events;
- rescheduled events;
- cancelled events;
- missing price;
- missing image;
- venue spelling variants.
