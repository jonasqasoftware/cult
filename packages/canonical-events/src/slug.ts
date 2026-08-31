const COMBINING_MARKS = /\p{M}/gu;

// Deterministic slug generation only. This is NOT identity — CanonicalEvent.id is the
// identity; two different events may legitimately produce the same slug and that is a
// concern for a future milestone (deduplication/URL collision), not this function.
export function generateSlug(input: string): string {
  return input
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
