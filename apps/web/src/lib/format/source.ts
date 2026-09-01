// M10.2 Phase B — the event detail page's "Fonte"/"Fontes" section used to render
// `source.source_id` verbatim (e.g. "ticketmaster", "ui-demo"), exposing a technical id where
// a human-readable name belongs — surfaced during the UI Demo Dataset's manual review
// (docs/quality/UI_DEMO_DATASET.md). Strictly presentational, same discipline as
// category.ts's KNOWN_CATEGORY_LABELS: never changes what's sent to/received from the API,
// and always falls back to the raw id for a source not in this table (transparency over a
// guessed/invented name).
const KNOWN_SOURCE_LABELS: Record<string, string> = {
  ticketmaster: "Ticketmaster",
  "destino-poa": "Destino POA",
  "manual-beta": "Curadoria CULT",
  // Deliberately NOT "CULT" or "Curadoria CULT" — ui-demo is fictional, development/demo-only
  // content (docs/sources/ui-demo.md) and must never read as a real cultural source or as
  // CULT's own authorized curation.
  "ui-demo": "Conteúdo demonstrativo CULT",
};

export function presentSourceLabel(sourceId: string): string {
  return KNOWN_SOURCE_LABELS[sourceId] ?? sourceId;
}
