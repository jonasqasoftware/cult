import {
  createCanonicalEvent,
  createEventSourceReference,
  createSourceDefinition,
  createTimedEventOccurrence,
} from "@cult/domain";
import { eq } from "drizzle-orm";
import { createCanonicalEventRepository, events, upsertSource, type Database } from "@cult/database";

// M10.1 section 9 — shared by images.spec.ts and visual-smoke.spec.ts so both exercise the
// exact same deterministic "valid image" event through the real stack (database -> API ->
// Web -> browser), using CULT's own synthetic asset (apps/web/public/test-assets/
// event-cover.svg — see section 8) rather than the golden fixtures' deliberately-broken
// `example.invalid` image URLs (section 7).
export const VALID_IMAGE_EVENT_ID = "e2e-image-evt-valid";
export const VALID_IMAGE_EVENT_SLUG = "e2e-image-evt-valid";
export const VALID_IMAGE_EVENT_TITLE = "Evento E2E Imagem Válida";
// Root-relative, not an absolute http://localhost:3000/... URL: resolves correctly against
// whichever origin/port the Web app is actually served from (WEB_PORT is configurable — see
// e2e/playwright.config.ts), so this fixture isn't coupled to the default port.
export const VALID_IMAGE_URL = "/test-assets/event-cover.svg";

const REF = new Date("2026-01-01T00:00:00Z");
const STARTS_AT = new Date("2026-09-18T19:00:00-03:00");

export async function seedValidImageEvent(db: Database): Promise<void> {
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
      id: VALID_IMAGE_EVENT_ID,
      slug: VALID_IMAGE_EVENT_SLUG,
      title: VALID_IMAGE_EVENT_TITLE,
      status: "scheduled",
      imageUrl: VALID_IMAGE_URL,
      occurrences: [
        createTimedEventOccurrence({
          id: "e2e-image-occ-valid",
          eventId: VALID_IMAGE_EVENT_ID,
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

export async function deleteValidImageEvent(db: Database): Promise<void> {
  await db.delete(events).where(eq(events.id, VALID_IMAGE_EVENT_ID));
}
