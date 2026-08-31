import { createHash } from "node:crypto";

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

// Two source events sharing a title (e.g. the same touring show on different nights, or a
// generic name like "Show de Rock") would otherwise collide on events.slug (UNIQUE). This
// appends a short, deterministic suffix derived from (sourceId, externalId) so:
//   - the same source event always gets the same slug across re-ingestion runs;
//   - two distinct source events never collide just because their titles match.
export function buildEventSlug(title: string, sourceId: string, externalId: string): string {
  const suffix = createHash("sha256").update(`${sourceId}:${externalId}`).digest("hex").slice(0, 8);
  const base = generateSlug(title);
  return base ? `${base}-${suffix}` : suffix;
}
