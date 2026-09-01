import {
  createCanonicalEvent,
  createEventSourceReference,
  createSourceDefinition,
  createTimedEventOccurrence,
} from "@cult/domain";
import { eq } from "drizzle-orm";
import { createCanonicalEventRepository, events, upsertSource, type Database } from "@cult/database";

// M10.1 section 9 — shared by images.spec.ts and visual-smoke.spec.ts so both exercise the
// exact same deterministic "valid image" scenario through the real stack (database -> API ->
// Web -> browser), using CULT's own synthetic asset (apps/web/public/test-assets/
// event-cover.svg — see section 8) rather than the golden fixtures' deliberately-broken
// `example.invalid` image URLs (section 7).
//
// Each *file* gets its own uniquely-identified event (via `buildValidImageEventConfig`), not
// one shared row: images.spec.ts and visual-smoke.spec.ts are separate spec files, each with
// its own file-scoped `beforeAll`/`afterAll` seeding and deleting a row — under
// `fullyParallel`, different files can run concurrently in different workers, so a single
// shared row would let one file's cleanup delete it out from under the other file's still-
// running test (the exact same class of race `.serial` fixes *within* a file, just across
// files instead — see images.spec.ts's own header comment for the in-file version of this).
export interface ValidImageEventConfig {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
}

export function buildValidImageEventConfig(owner: string): ValidImageEventConfig {
  return {
    id: `e2e-image-evt-${owner}`,
    slug: `e2e-image-evt-${owner}`,
    title: `Evento E2E Imagem Válida (${owner})`,
  };
}

// Root-relative, not an absolute http://localhost:3000/... URL: resolves correctly against
// whichever origin/port the Web app is actually served from (WEB_PORT is configurable — see
// e2e/playwright.config.ts), so this fixture isn't coupled to the default port. Safe to share
// across both files' events — it's a static, read-only asset file, not a mutable DB row.
export const VALID_IMAGE_URL = "/test-assets/event-cover.svg";

const REF = new Date("2026-01-01T00:00:00Z");
const STARTS_AT = new Date("2026-09-18T19:00:00-03:00");

export async function seedValidImageEvent(db: Database, config: ValidImageEventConfig): Promise<void> {
  await upsertSource(
    db,
    createSourceDefinition({
      id: "e2e-image-source",
      name: "E2E Image Source",
      type: "manual",
      enabled: true,
      pollingIntervalMinutes: 60,
      authorityScore: 0.7,
      commercialUse: "allowed",
      connector: "e2e-image",
    }),
  );

  const repository = createCanonicalEventRepository(db);
  await repository.save(
    createCanonicalEvent({
      id: config.id,
      slug: config.slug,
      title: config.title,
      status: "scheduled",
      imageUrl: VALID_IMAGE_URL,
      occurrences: [
        createTimedEventOccurrence({
          id: `${config.id}-occ`,
          eventId: config.id,
          startsAt: STARTS_AT,
          status: "scheduled",
        }),
      ],
      sources: [
        createEventSourceReference({
          sourceId: "e2e-image-source",
          url: "https://example.org/e2e-image-source",
          firstSeenAt: REF,
          lastSeenAt: REF,
          confidence: 0.9,
        }),
      ],
      qualityScore: 0.5,
      rankingScore: 0.5,
      firstSeenAt: REF,
      lastSeenAt: REF,
      createdAt: REF,
      updatedAt: REF,
    }),
  );
}

export async function deleteValidImageEvent(db: Database, config: ValidImageEventConfig): Promise<void> {
  await db.delete(events).where(eq(events.id, config.id));
}
