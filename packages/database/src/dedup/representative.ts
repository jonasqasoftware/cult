import type { CanonicalEvent } from "@cult/domain";

// M9 section 20: a conservative, explainable representative policy — we do NOT trust
// qualityScore/rankingScore's precision (still M2 provisional placeholders per
// packages/canonical-events), so the policy avoids leaning on them at all:
//
//   1. more useful public fields filled in (completeness)
//   2. higher max source confidence
//   3. event id (deterministic tie-breaker)
//
// This is presentation suppression, not reconciliation (section 21) — selectRepresentative
// only picks WHICH of the two events to show; it never merges fields from one into the other.
function completenessScore(event: CanonicalEvent): number {
  let score = 0;
  if (event.description) score += 1;
  if (event.categoryId) score += 1;
  if (event.venue) {
    score += 1;
    if (event.venue.address) score += 1;
    if (event.venue.neighborhood) score += 1;
    // Geo completeness matters enough on its own to weigh more than one point — a
    // representative with no coordinates would silently break "nearby" for this pair
    // (section 25), so an event that actually has them should reliably win the tie.
    if (event.venue.latitude != null && event.venue.longitude != null) score += 2;
  }
  if (event.imageUrl) score += 1;
  if (event.ticketUrl) score += 1;
  if (event.performers.length > 0) score += 1;
  if (event.price) score += 1;
  return score;
}

function maxSourceConfidence(event: CanonicalEvent): number {
  return event.sources.reduce((max, source) => Math.max(max, source.confidence), 0);
}

export function selectRepresentative(a: CanonicalEvent, b: CanonicalEvent): CanonicalEvent {
  const completenessA = completenessScore(a);
  const completenessB = completenessScore(b);
  if (completenessA !== completenessB) {
    return completenessA > completenessB ? a : b;
  }

  const confidenceA = maxSourceConfidence(a);
  const confidenceB = maxSourceConfidence(b);
  if (confidenceA !== confidenceB) {
    return confidenceA > confidenceB ? a : b;
  }

  return a.id <= b.id ? a : b;
}
