# UI Demo Dataset

M10.2 Phase A. A second, separate dataset from the golden/technical fixtures, built for one
purpose only: opening CULT locally and judging what it actually looks like with visually rich,
varied content — not to validate normalization, dedup, or the temporal model (the golden
fixtures already do that, and are untouched by this).

## Objetivo

Let a human open `http://localhost:3000` locally and evaluate the current design against
realistic-looking (but entirely fictional) event content — full cards, mixed categories,
free/paid events, real loadable cover images, and the one deliberately-missing-image case —
before deciding whether/what to change visually (Phase B, not part of this milestone).

## O que não é

- **Not production data.** `ui-demo`'s `commercialUse` is `restricted` and is never meant to
  become `allowed` — see `docs/sources/ui-demo.md`. `pnpm demo:seed` refuses to run at all
  under `CULT_ENV=production`.
- **Not the golden dataset.** `test-data/golden-events/**` (Ticketmaster, Destino POA, manual,
  dedup) is untouched — same fixtures, same expectations, same tests, same `example.invalid`
  URLs (kept exactly as-is; they're good fixtures for the broken-image fallback path, see
  `images.spec.ts`).
- **Not a real manual source.** `manual-beta` (the M10 beta fallback, `commercialUse: allowed`)
  is a separate source with a separate identity — `ui-demo` deliberately does not reuse it, so
  demo content is never indistinguishable from real, rights-cleared manual entries.
- **Does not demonstrate any external content rights.** Every title, description, venue, and
  cover image in `test-data/ui-demo/events.json` is invented for this dataset. No text or
  imagery is copied from Ticketmaster, Destino POA, Sympla, Instagram, the Prefeitura, real
  venues, or real producers. Venue names are explicitly marked "(fictício)" in the dataset
  itself. Cover images are original SVGs made for this dataset
  (`apps/web/public/demo-events/*.svg`) — no third-party photography, no logos, no real
  people.

## O que contém

10 fictional events in `test-data/ui-demo/events.json`, covering:

- **Pricing**: free (5), regular paid (3), low/"starting from" priced (2).
- **Temporal shape**: timed (6), date-only (2), multi-day date range (2).
- **Content length**: one short title/description (Sarau Entre Linhas), one long
  title/description (Exposição Luzes do Sul).
- **Location detail**: with/without a street address, with/without a neighborhood — every
  combination appears at least once.
- **Images**: 9 events with a real, loadable local SVG cover; 1 (Encontro Cultural na Orla)
  with no image at all, to compare against the fallback placeholder honestly.
- **Geo** (M10.2 Phase C): 9 events carry a synthetic, approximate `latitude`/`longitude` so
  the map view actually shows markers; Encontro Cultural na Orla deliberately has neither
  (the same event that also has no image), continuing to exercise the no-location path on
  both the card grid and the map. Coordinates are loosely placed within the stated
  neighborhood/region (Orla, Cidade Baixa, Zona Sul, Centro Histórico) — **not** real,
  precise addresses; no fictional event is presented as occupying an exact real building.
- **Categories** (8, deliberately not 10 — see section 8 of the milestone spec): Show de
  música, Cinema, Cultural, Exposição, Literatura, Teatro e Artes, Passeio Cultural,
  Gastronomia.
- **Ticket CTA**: no event carries a `ticketUrl` (see the Phase C entry below) — every demo
  event's "Ver ingresso" button is therefore absent, which is correct: there is no real
  ticket destination to send anyone to.

8 original SVG cover assets in `apps/web/public/demo-events/`
(`demo-music.svg`, `demo-cinema.svg`, `demo-fair.svg`, `demo-exhibition.svg`,
`demo-literature.svg`, `demo-theater.svg`, `demo-city.svg`, `demo-food.svg`) — abstract,
editorial compositions with real visual weight and distinct identities from each other, not
technical gray placeholders. No brand, logo, real photograph, or real person appears in any of
them.

## Observações da revisão manual

**Category labels — resolved in M10.2 Phase B.** Three of the eight demo categories
(`Exposição` → `exposicao`, `Teatro e Artes` → `teatro-e-artes`, `Passeio Cultural` →
`passeio-cultural`) were not in `apps/web/src/lib/format/category.ts`'s
`KNOWN_CATEGORY_LABELS` map, so their category chips showed the raw technical slug instead of
a friendly label — real, pre-existing behavior the demo dataset surfaced honestly. Fixed by
adding those three entries to the same lookup table (purely presentational — no API/category
id change).

**Source attribution label — resolved in M10.2 Phase B.** The event detail page's
"Fonte"/"Fontes" section rendered `source.source_id` verbatim, so a demo event's source link
read literally as "ui-demo" — a technical id, not something a visitor should ever see. Fixed
via a new `presentSourceLabel` formatter (`apps/web/src/lib/format/source.ts`): `ticketmaster`
→ "Ticketmaster", `destino-poa` → "Destino POA", `manual-beta` → "Curadoria CULT", `ui-demo` →
"Conteúdo demonstrativo CULT" (deliberately not "CULT" or "Curadoria CULT" — this is fictional,
development/demo-only content and must never read as real CULT curation). An unrecognized
source id still falls back to the raw id, same transparency principle as category labels.

**Ticket CTA pointed at a fictional destination — resolved in M10.2 Phase C.** Two demo events
(Noite Indie no Centro, Teatro na Cidade Baixa) carried a `ticketUrl` of
`https://example.org/cult-demo/ingressos/...`, so their detail pages showed a "Ver ingresso"
button that led nowhere real — worse than showing no button at all. `TrackedLink`/the detail
page were **not** changed (this was purely a data problem, confirmed by inspecting both real
connectors: Ticketmaster's `ticketUrl` is its own event page URL — genuinely a ticket
destination per Ticketmaster's API contract — and Destino POA's is `externalUrl`, an explicit,
separate "official external link" field; neither needed a fix). The fictional `ticketUrl` was
simply removed from both demo events; `sourceUrl` (provenance) is untouched.

**Map showed zero demo markers — resolved in M10.2 Phase C.** `ManualEventDto`
(`packages/connectors/src/manual/manual-types.ts`, shared by `manual-beta` and `ui-demo`) had
no `latitude`/`longitude` fields at all, so no manual-shaped event — demo or otherwise — could
ever produce a map marker; `ResultsView`/`MapView` were already filtering/rendering correctly.
Added optional `latitude`/`longitude` to the DTO and the normalizer (both required together,
range-validated by the same `createVenue` the domain already uses for every other source — see
`packages/connectors/src/manual/manual-normalizer.test.ts`), then added synthetic coordinates
to 9 of the 10 demo events (see "O que contém" above). No geocoding was added — coordinates
must be supplied directly, exactly like every other field a curator provides.

**A real, unrelated bug found while investigating this — documented, not fixed.** Ticketmaster
and Destino POA's golden fixtures both include an event at a venue named "Praça da Alfândega".
Neither normalizer is given (or invents) a source-specific venue id for it, so both fall back
to the same deterministic `venue-${slug(name)}` id — and whichever source's ingestion runs
*second* silently overwrites the shared `venues` row, including its `latitude`/`longitude`
(Ticketmaster's "Feira Gratuita do Centro" has real geo in isolation; ingest Destino POA
afterward and it's gone, because Destino POA's own venue-building for the same place carries no
geo at all). This is a real, pre-existing cross-source venue-identity collision, not something
introduced by the UI Demo Dataset or this phase's changes — and out of scope for M10.2 Phase C,
which is data/view-state hardening only, not a venue-identity redesign. Filed here so it isn't
lost: a real fix needs a source-namespaced venue id (or an actual venue-dedup pass), not a
patch local to one connector.

**Page 1 doesn't show all 10 demo events without "Carregar mais" — not corrected.** Home's
first page uses `PAGE_SIZE = 12` (`apps/web/src/app/page.tsx`); interleaved chronologically
with the 14 golden fixture events, only 6 of the 10 demo events land on page 1 (Jazz ao
Entardecer, Encontro Cultural na Orla, Exposição Luzes do Sul, Noite Indie no Centro, Sarau
Entre Linhas, Mostra de Cinema do Guaíba) — Feira Criativa da Redenção, Teatro na Cidade Baixa,
Visita Arquitetônica ao Centro, and Festival de Gastronomia Urbana require clicking "Carregar
mais". The API/page size is deliberately **not** changed to work around this — it's documented
instead. Two easy ways to see every demo event at once for review purposes: click "Carregar
mais" once, or filter/search (e.g. `pnpm demo:reset` then re-seed against an otherwise-empty
golden-fixture set, or open `/?q=<part of a title>` for a specific one).

## Como usar

```bash
docker compose up -d postgres
pnpm db:migrate
pnpm demo:seed
pnpm dev:api    # separate terminal
pnpm dev:web    # separate terminal
```

Then open `http://localhost:3000`.

`pnpm demo:seed` is idempotent — running it again updates the same 10 rows, never duplicates
them. `pnpm demo:reset` removes only the UI demo events (matched by their deterministic
`ui-demo-*` id prefix) — it never touches golden fixtures, `manual-beta` entries, or analytics
data. See `docs/sources/ui-demo.md` for the full mechanism.

### Fluxo local recomendado (ordem importa)

`pnpm test` truncates the shared local dev database as part of its own integration-test
lifecycle (established in M10.1) — so run the gates that use it *before* seeding demo content,
never after:

```bash
# 1. Gates that clean the DB as a side effect
pnpm lint
pnpm typecheck
pnpm test
pnpm build

# 2. THEN prepare the database for manual review
docker compose up -d postgres
pnpm db:migrate
pnpm ingest:ticketmaster:fixture
pnpm ingest:destino-poa:fixture
pnpm demo:seed

# 3. THEN start the app and open it
pnpm dev:api
pnpm dev:web
```

Running `pnpm test` after `pnpm demo:seed` and expecting the demo dataset to still be there
will not work — re-run `pnpm demo:seed` again afterward if that happens.

## Validação manual

After `pnpm demo:seed` and with `pnpm dev:api`/`pnpm dev:web` running, open
`http://localhost:3000` and review:

- **Desktop, 1280px** — the default grid with mixed free/paid, timed/date-only cards.
- **Mobile, 390px** — the same content in a narrow viewport.

This phase deliberately stops at *observation* — no visual/design change is made
automatically as a result of this dataset existing. `docs/quality/UI_EXPLORATORY_CHECKLIST.md`
is the companion checklist for a broader manual pass (image fallback, filters, map, share,
etc.) using either this dataset or the golden fixtures.
