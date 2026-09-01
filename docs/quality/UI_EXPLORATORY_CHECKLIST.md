# UI Exploratory Checklist

M10.1 section 33. A short, manual pass a human runs by hand before staging — not a replacement
for `pnpm e2e`/`pnpm e2e:visual` (docs on those in `apps/web/README.md`'s "Test pyramid"
section), but a check for the things automation is structurally weakest at: does this actually
feel right, not just "does the assertion pass."

Run against a locally-built stack (Postgres + fixtures + API + Web) or a real staging
deployment. Use a real desktop browser and a real (or emulated) mobile device — not just
Chromium headless.

- [ ] **Home** — loads, shows event cards, nothing visually broken on first paint.
- [ ] **Search** — a real query returns expected results; an empty query clears back to the
      full list; a nonsense query shows the empty state, not a blank screen.
- [ ] **Combined filters** — apply two or more filters in sequence (e.g. category then free);
      confirm the visible cards match the *combination*, not just the last filter clicked.
- [ ] **Back/forward** — apply a filter, apply another, use the browser's back button; confirm
      the page shows the *previous* filter's results, not a stale mix of both.
- [ ] **Image — valid** — an event with a real image shows it fully loaded, no layout jump
      once it finishes.
- [ ] **Image — fallback** — an event with a missing/broken image shows the CULT placeholder,
      never a native broken-image icon or blank space.
- [ ] **Cards** — spot-check a few different card shapes: with/without image, long title,
      priced vs. free, date-only vs. timed occurrence — nothing overlaps or truncates badly.
- [ ] **Detail** — open an event, confirm ticket/source links are present and point somewhere
      real, image (if any) matches the card, back returns to discovery with filters intact.
- [ ] **Map** — toggle to Mapa, confirm tiles load and at least one marker is visible and
      clickable; toggle back to Lista.
- [ ] **Nearby** — trigger "Perto de mim", grant location, confirm results update; deny
      location and confirm the rest of the product still works normally.
- [ ] **Share** — trigger the share action, confirm either the native share sheet or the
      clipboard-copy confirmation appears.
- [ ] **Mobile (390px)** — no horizontal scrolling anywhere in the flows above; touch targets
      (filter chips, buttons) are comfortably tappable.
- [ ] **Desktop** — layout uses the available width sensibly (a multi-column grid where there
      are enough cards, not a single narrow column stretched across a wide screen).
- [ ] **No horizontal overflow** — resize the window / rotate the emulated device mid-session;
      nothing causes the page to scroll sideways.

If something here fails but every automated test is green, that's a real gap in the automated
suite worth filing — not something to wave off because "the tests pass."
