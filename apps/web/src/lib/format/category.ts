import type { Category } from "../api/types";

// M7.1: the API has no human-readable name source — id/name/slug all mirror the raw
// technical category id. This is a strictly presentational lookup for ids actually observed
// from the two approved sources (Ticketmaster, Destino POA); it never changes what's sent to
// the API, never invents a new taxonomy, and always falls back to the API's own `name` for
// any id not in this table (M8 section 16).
const KNOWN_CATEGORY_LABELS: Record<string, string> = {
  music: "Música",
  "show-de-musica": "Show de Música",
  "arts-theatre": "Teatro e Artes",
  theater: "Teatro",
  theatre: "Teatro",
  cinema: "Cinema",
  cultural: "Cultural",
  literatura: "Literatura",
  gastronomia: "Gastronomia",
  miscellaneous: "Diversos",
};

export function presentCategoryLabel(category: Category): string {
  return KNOWN_CATEGORY_LABELS[category.id] ?? category.name;
}

// For contexts (e.g. the event detail page) that only have the bare category id, not a full
// Category object with its own `name` field to fall back to — the API's `name` currently
// always equals `id` anyway (M7.1), so falling back to the id itself is equivalent.
export function presentCategoryLabelFromId(id: string): string {
  return KNOWN_CATEGORY_LABELS[id] ?? id;
}

export function buildCategoryLabelMap(categories: readonly Category[]): ReadonlyMap<string, string> {
  return new Map(categories.map((category) => [category.id, presentCategoryLabel(category)]));
}
