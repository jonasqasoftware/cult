# Source: Destino POA

**Status: OFFICIAL SOURCE — REUSE/COMMERCIAL RIGHTS NOT YET CONFIRMED**

## Owner / origin

Destino POA (`destinopoa.com.br`) presents itself as the official tourism and cultural-agenda
portal for Porto Alegre. Contact addresses observed (`eventos@destinopoa.com.br`,
`contato@destinopoa.com.br`) are consistent with an official/municipal-tourism-board
operation, but no explicit terms-of-reuse or data-licensing page was found during this
milestone's discovery spike.

- **URL:** https://destinopoa.com.br/
- **Agenda:** https://destinopoa.com.br/agenda/
- **Sitemap:** https://destinopoa.com.br/sitemap.xml (declared in `robots.txt`)

## Technical method observed (read-only discovery spike, 2026-08-31)

Priority order per this milestone's rules — checked from most to least structured:

1. **Public documented API** — not available. The site exposes a WordPress REST API
   discovery document at `/wp-json/`, but the actual content routes
   (`/wp-json/wp/v2/posts`, and a probed `/wp-json/wp/v2/evento`) both return **HTTP 401
   Unauthorized** — a security plugin (`ithemes-security`, present in the `/wp-json/`
   namespace list) blocks anonymous REST content reads. This is a deliberate access
   restriction; **CULT does not attempt to bypass it** (see `CLAUDE.md` / this repo's
   security rules).
2. **JSON-LD / Schema.org** — not usable. The agenda page DOES include
   `<script type="application/ld+json">` blocks, but they are generic SEO-plugin site schema
   (`WebSite`, `SearchAction`) — confirmed by direct inspection of the raw HTML, and now
   asserted by `pnpm inspect:destino-poa`'s `structuredDataDetected` field, which specifically
   checks for an `Event`-typed block, not just the tag's presence. No `Event` markup exists
   on the agenda listing or a sampled event detail page.
3. **Structured public endpoint** — the agenda page uses the FacetWP plugin for filtering
   (`?_data_evento=...`, `?_cat_evento=...`), which has an internal AJAX endpoint
   (`/wp-admin/admin-ajax.php`, allowed by `robots.txt`). This is an **undocumented,
   internal** endpoint tied to the site's own front-end JS (nonce-based), not a stable
   public contract — not used.
4. **Server-rendered HTML** — **this is the method CULT uses.** Both the `/agenda/`
   listing and individual `/evento/{slug}/` detail pages are plain server-rendered HTML
   with visible, consistent fields (see below).

`robots.txt` only disallows `/wp-admin/` (with an explicit `Allow` for
`admin-ajax.php`); `/agenda/` and `/evento/*` are not restricted.

### Fields observed on real pages (structure only — no verbatim content reused)

- Title, one or more category tags (e.g. "Cultural", "Dança", "Show de música"), a
  "Gratuitos" tag on free events, a featured image, and a date/time string that is
  **sometimes a single day+time and sometimes a multi-day range with no time at all**
  (e.g. "29 de agosto a 20 de setembro de 2026" for a park exhibition/encampment-style
  event) — see [ADR-0014](../adr/0014-event-occurrence-date-only-ranges.md) for why this
  matters.
- Individual event pages show a full street address (not just a venue name), and
  sometimes an official external website link (not a ticket-purchase URL in the
  Ticketmaster sense — more often "learn more" / the organizer's own site).

## Source Registry

```text
id: destino-poa
type: crawler   -- reflects the actual method found; never "api" (no public API exists)
commercialUse: unknown
```

`commercialUse` stays `"unknown"` — never `"allowed"` — until an operator finds and
documents an explicit reuse/licensing statement from Destino POA.

## Retention

Governed by the general policy in [ADR-0013](../adr/0013-source-specific-retention-policy.md):
no production retention duration is set for Destino POA. `raw_events.retention_until`
stays `NULL` (not yet decided) for this source, same as Ticketmaster.

## Attribution

No attribution requirement was found or is assumed. If Destino POA's terms are found later
to require attribution, this document must be updated before any commercial launch.

## Images

Image URLs are stored as references only (`imageUrl` on the canonical event). CULT does
not download, cache, mirror, or proxy Destino POA images — same rule as Ticketmaster.

## Risks

- **Fragility:** HTML scraping breaks on markup changes with no advance notice (unlike a
  versioned API). This connector's live path exists only as a bounded, read-only inspector
  (`pnpm inspect:destino-poa`) for this milestone — no live-persisting ingestion command
  exists yet (see M3 execution report).
- **Legal:** commercial use is unconfirmed. Do not use collected data commercially before
  this document is updated with a documented rights review.
- **Coverage gap from the domain model:** a meaningful share of real Destino POA listings
  are multi-day ranges or date-only (no time-of-day) — see ADR-0014. Until resolved, those
  events fail normalization explicitly (raw payload preserved, not silently dropped or
  guessed).

## Last reviewed

2026-08-31 (this document's authoring date, based on a bounded, read-only discovery spike
against the live site). Re-review before any production/commercial decision.
