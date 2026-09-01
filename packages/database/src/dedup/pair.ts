// M9 section 5: A+B and B+A are the same pair — always normalize before persisting, so the
// unique constraint on (left_event_id, right_event_id) can never be silently bypassed by
// storing both orderings.
export interface NormalizedPair {
  readonly leftEventId: string;
  readonly rightEventId: string;
}

export function normalizePair(eventIdA: string, eventIdB: string): NormalizedPair {
  return eventIdA < eventIdB
    ? { leftEventId: eventIdA, rightEventId: eventIdB }
    : { leftEventId: eventIdB, rightEventId: eventIdA };
}
