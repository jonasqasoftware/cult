import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inArray } from "drizzle-orm";
import { expect, test } from "@playwright/test";
import {
  createCanonicalEvent,
  createEventSourceReference,
  createSourceDefinition,
  createTimedEventOccurrence,
  createVenue,
} from "@cult/domain";
import {
  createCanonicalEventRepository,
  createDatabaseConnection,
  events,
  upsertSource,
  type Database,
} from "@cult/database";

// M9 section 39: DB -> two same events -> dedup scan -> API -> Web, confirming only one card
// renders for a strong-same pair, and confirming a genuinely ambiguous pair still shows both
// (dedup never hides a pending_review candidate). The scan step shells out to the real
// `pnpm dedup:scan` CLI (not an in-process import of the worker's TS source) — Playwright's
// own test transform doesn't cleanly resolve @cult/deduplication's compiled ESM output
// through that import chain, and invoking the actual command is arguably more faithful to
// "dedup scan" as a step in this flow anyway.
const DATABASE_URL = process.env["DATABASE_URL"] ?? "postgresql://cult:cult@localhost:5432/cult";
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function runDedupScanCli(): void {
  execFileSync("pnpm", ["--filter", "@cult/worker", "run", "dedup:scan"], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL },
    stdio: "pipe",
  });
}

// This suite is the only spec file that writes live data during a run (every other spec reads
// the fixture set ingested once before `pnpm e2e`). Without cleanup, the events inserted here
// would persist in the shared dev DB across runs and shift what other specs see on page 1 of
// the default/unfiltered views (pagination counts, the single geo-tagged marker, etc.) — so
// each test removes exactly the events it created. The FK cascade from dedup_candidates/
// event_occurrences/event_sources to events (onDelete: "cascade") means deleting the events is
// sufficient to also remove any candidate row the scan created for them.
async function deleteEvents(db: Database, eventIds: readonly string[]): Promise<void> {
  await db.delete(events).where(inArray(events.id, eventIds));
}

const REF = new Date("2026-01-01T00:00:00Z");

function eventSource(sourceId: string) {
  return createEventSourceReference({
    sourceId,
    url: `https://example.org/${sourceId}`,
    firstSeenAt: REF,
    lastSeenAt: REF,
    confidence: 0.8,
  });
}

// dedup:scan operates on the whole events table, not just the pair a test just inserted — running
// these two tests concurrently (Playwright's default under fullyParallel) would let one test's
// in-flight rows and in-flight scan race the other's. Serial keeps each test's slice of state
// (and its cleanup) fully settled before the next one starts.
test.describe.serial("dedup integration", () => {
  test("a strong cross-source duplicate is auto-approved by dedup:scan and shown as one card", async ({
    page,
  }) => {
    const connection = createDatabaseConnection({ connectionString: DATABASE_URL });
    const repository = createCanonicalEventRepository(connection.db);
    try {
      await upsertSource(
        connection.db,
        createSourceDefinition({
          id: "e2e-dedup-source-a",
          name: "E2E Dedup Source A",
          type: "api",
          enabled: true,
          pollingIntervalMinutes: 60,
          authorityScore: 0.7,
          commercialUse: "restricted",
          connector: "e2e-dedup-a",
        }),
      );
      await upsertSource(
        connection.db,
        createSourceDefinition({
          id: "e2e-dedup-source-b",
          name: "E2E Dedup Source B",
          type: "crawler",
          enabled: true,
          pollingIntervalMinutes: 60,
          authorityScore: 0.6,
          commercialUse: "unknown",
          connector: "e2e-dedup-b",
        }),
      );

      const venue = createVenue({
        id: "e2e-dedup-venue",
        name: "Teatro E2E Dedup",
        city: "Porto Alegre",
        state: "RS",
      });
      const startsAt = new Date("2026-09-25T20:00:00-03:00");

      await repository.save(
        createCanonicalEvent({
          id: "e2e-dedup-evt-a",
          slug: "e2e-dedup-evt-a",
          title: "Show E2E Dedup Único",
          status: "scheduled",
          occurrences: [
            createTimedEventOccurrence({
              id: "e2e-dedup-occ-a",
              eventId: "e2e-dedup-evt-a",
              startsAt,
              status: "scheduled",
            }),
          ],
          venue,
          sources: [eventSource("e2e-dedup-source-a")],
          qualityScore: 0.5,
          rankingScore: 0.5,
          firstSeenAt: REF,
          lastSeenAt: REF,
          createdAt: REF,
          updatedAt: REF,
        }),
      );
      await repository.save(
        createCanonicalEvent({
          id: "e2e-dedup-evt-b",
          slug: "e2e-dedup-evt-b",
          title: "Show E2E Dedup Único",
          status: "scheduled",
          occurrences: [
            createTimedEventOccurrence({
              id: "e2e-dedup-occ-b",
              eventId: "e2e-dedup-evt-b",
              startsAt,
              status: "scheduled",
            }),
          ],
          venue,
          sources: [eventSource("e2e-dedup-source-b")],
          qualityScore: 0.5,
          rankingScore: 0.5,
          firstSeenAt: REF,
          lastSeenAt: REF,
          createdAt: REF,
          updatedAt: REF,
        }),
      );

      runDedupScanCli();

      await page.goto("/?q=Show+E2E+Dedup+%C3%9Anico");
      const eventList = page.getByRole("list", { name: "Lista de eventos" });
      await expect(eventList.getByRole("listitem")).toHaveCount(1);
      await expect(page.getByText("Show E2E Dedup Único")).toBeVisible();
    } finally {
      await deleteEvents(connection.db, ["e2e-dedup-evt-a", "e2e-dedup-evt-b"]);
      await connection.close();
    }
  });

  test("a review-routed pair is not suppressed — both events stay visible", async ({ page }) => {
    const connection = createDatabaseConnection({ connectionString: DATABASE_URL });
    const repository = createCanonicalEventRepository(connection.db);
    try {
      await upsertSource(
        connection.db,
        createSourceDefinition({
          id: "e2e-review-source-a",
          name: "E2E Review Source A",
          type: "api",
          enabled: true,
          pollingIntervalMinutes: 60,
          authorityScore: 0.7,
          commercialUse: "restricted",
          connector: "e2e-review-a",
        }),
      );
      await upsertSource(
        connection.db,
        createSourceDefinition({
          id: "e2e-review-source-b",
          name: "E2E Review Source B",
          type: "crawler",
          enabled: true,
          pollingIntervalMinutes: 60,
          authorityScore: 0.6,
          commercialUse: "unknown",
          connector: "e2e-review-b",
        }),
      );

      // Same instant, 3-of-4 shared significant title words, no venue evidence either way —
      // the exact "ambiguous" recipe verified in the M6 final report to land in the review
      // band (score ~0.83), not confidently same or confidently different.
      const startsAt = new Date("2026-10-05T19:00:00-03:00");
      await repository.save(
        createCanonicalEvent({
          id: "e2e-review-evt-a",
          slug: "e2e-review-evt-a",
          title: "Encontro Cultural E2E Praça Central",
          status: "scheduled",
          occurrences: [
            createTimedEventOccurrence({
              id: "e2e-review-occ-a",
              eventId: "e2e-review-evt-a",
              startsAt,
              status: "scheduled",
            }),
          ],
          sources: [eventSource("e2e-review-source-a")],
          qualityScore: 0.5,
          rankingScore: 0.5,
          firstSeenAt: REF,
          lastSeenAt: REF,
          createdAt: REF,
          updatedAt: REF,
        }),
      );
      await repository.save(
        createCanonicalEvent({
          id: "e2e-review-evt-b",
          slug: "e2e-review-evt-b",
          title: "Encontro Cultural E2E Praça Histórica",
          status: "scheduled",
          occurrences: [
            createTimedEventOccurrence({
              id: "e2e-review-occ-b",
              eventId: "e2e-review-evt-b",
              startsAt,
              status: "scheduled",
            }),
          ],
          sources: [eventSource("e2e-review-source-b")],
          qualityScore: 0.5,
          rankingScore: 0.5,
          firstSeenAt: REF,
          lastSeenAt: REF,
          createdAt: REF,
          updatedAt: REF,
        }),
      );

      runDedupScanCli();

      // Word-similarity search (see discover-events.ts's buildSearchCondition) is intentionally
      // fuzzy/accent-tolerant, so this phrase can also loosely match unrelated fixture titles that
      // share common Portuguese words ("Cultural", "Praça", ...) — the total result count isn't a
      // meaningful assertion here. What section 39 actually requires is that neither half of a
      // review-routed pair got suppressed, so assert both exact titles are present instead.
      await page.goto("/?q=Encontro+Cultural+E2E");
      await expect(page.getByText("Encontro Cultural E2E Praça Central")).toBeVisible();
      await expect(page.getByText("Encontro Cultural E2E Praça Histórica")).toBeVisible();
    } finally {
      await deleteEvents(connection.db, ["e2e-review-evt-a", "e2e-review-evt-b"]);
      await connection.close();
    }
  });
});
