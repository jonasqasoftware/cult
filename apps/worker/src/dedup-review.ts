import {
  createDatabaseConnection,
  decideCandidate,
  getCandidateById,
  listPendingReview,
  loadCanonicalEventsByIds,
  type DedupCandidateRow,
} from "@cult/database";
import type { CanonicalEvent } from "@cult/domain";

export interface PendingReviewEntry {
  readonly candidate: DedupCandidateRow;
  readonly left: CanonicalEvent | undefined;
  readonly right: CanonicalEvent | undefined;
}

// M9 section 15: everything a human needs to decide same/different, without the CLI (or the
// person) ever seeing the engine's internal Golden Dataset labels — this reads only real,
// currently-persisted CanonicalEvents and the engine's own stored assessment.
export async function listPendingReviewCandidates(databaseUrl: string): Promise<readonly PendingReviewEntry[]> {
  const connection = createDatabaseConnection({ connectionString: databaseUrl });
  try {
    const candidates = await listPendingReview(connection.db);
    const eventIds = [...new Set(candidates.flatMap((c) => [c.leftEventId, c.rightEventId]))];
    const events = await loadCanonicalEventsByIds(connection.db, eventIds);
    const eventById = new Map(events.map((event) => [event.id, event]));
    return candidates.map((candidate) => ({
      candidate,
      left: eventById.get(candidate.leftEventId),
      right: eventById.get(candidate.rightEventId),
    }));
  } finally {
    await connection.close();
  }
}

export async function decideCandidateBySame(
  databaseUrl: string,
  candidateId: string,
  now: Date,
): Promise<DedupCandidateRow | null> {
  const connection = createDatabaseConnection({ connectionString: databaseUrl });
  try {
    return await decideCandidate(connection.db, candidateId, "confirmed_same", now);
  } finally {
    await connection.close();
  }
}

export async function decideCandidateByDifferent(
  databaseUrl: string,
  candidateId: string,
  now: Date,
): Promise<DedupCandidateRow | null> {
  const connection = createDatabaseConnection({ connectionString: databaseUrl });
  try {
    return await decideCandidate(connection.db, candidateId, "confirmed_different", now);
  } finally {
    await connection.close();
  }
}

export async function findCandidate(databaseUrl: string, candidateId: string): Promise<DedupCandidateRow | null> {
  const connection = createDatabaseConnection({ connectionString: databaseUrl });
  try {
    return await getCandidateById(connection.db, candidateId);
  } finally {
    await connection.close();
  }
}
