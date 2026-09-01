import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createCanonicalEvent,
  createDateOnlyEventOccurrence,
  createEventSourceReference,
  createTimedEventOccurrence,
  createVenue,
  type CanonicalEvent,
} from "@cult/domain";
import type { CanonicalEventFixture, DedupGoldenCase, GoldenDataset, OccurrenceFixture } from "./types.js";
export type { GoldenDataset } from "./types.js";

// packages/deduplication/src/golden-dataset/loader.ts -> up 4 levels (golden-dataset -> src
// -> deduplication -> packages) -> repo root -> test-data/golden-events/deduplication.
const DEFAULT_DATASET_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../test-data/golden-events/deduplication/cases.json",
);

// A fixed, arbitrary reference instant used only for the required firstSeenAt/lastSeenAt/
// createdAt/updatedAt/EventSourceReference timestamps that CanonicalEvent's invariants
// require but that carry no dedup-relevant signal in this dataset.
const FIXTURE_REFERENCE_INSTANT = new Date("2026-01-01T00:00:00Z");

// Provisional placeholder — same value @cult/canonical-events uses elsewhere; not imported
// from there to avoid a dependency purely for one constant used only in test fixtures.
const FIXTURE_QUALITY_SCORE = 0.5;
const FIXTURE_RANKING_SCORE = 0.5;
const DEFAULT_SOURCE_CONFIDENCE = 0.8;

export function loadGoldenDataset(datasetPath: string = DEFAULT_DATASET_PATH): GoldenDataset {
  const raw = readFileSync(datasetPath, "utf8");
  return JSON.parse(raw) as GoldenDataset;
}

export interface LoadedDedupCase {
  readonly case: DedupGoldenCase;
  readonly left: CanonicalEvent;
  readonly right: CanonicalEvent;
}

// Converts every case's left/right fixture into a REAL CanonicalEvent through the actual
// domain factories — the same construction path production normalizers use. A fixture that
// violates a domain invariant throws here (and the dataset test surfaces it as a failure),
// rather than silently producing an invalid object a future dedup engine might mishandle.
export function buildDedupCases(dataset: GoldenDataset): readonly LoadedDedupCase[] {
  return dataset.cases.map((dedupCase) => ({
    case: dedupCase,
    left: buildCanonicalEvent(dedupCase.left),
    right: buildCanonicalEvent(dedupCase.right),
  }));
}

export function loadDedupCases(datasetPath?: string): readonly LoadedDedupCase[] {
  return buildDedupCases(loadGoldenDataset(datasetPath));
}

function buildCanonicalEvent(fixture: CanonicalEventFixture): CanonicalEvent {
  const occurrence = buildOccurrence(fixture.occurrence, `${fixture.id}-occ`, fixture.id);

  const source = createEventSourceReference({
    sourceId: fixture.source.sourceId,
    ...(fixture.source.externalId !== undefined ? { externalId: fixture.source.externalId } : {}),
    url: fixture.source.url,
    firstSeenAt: FIXTURE_REFERENCE_INSTANT,
    lastSeenAt: FIXTURE_REFERENCE_INSTANT,
    confidence: fixture.source.confidence ?? DEFAULT_SOURCE_CONFIDENCE,
  });

  const venue = fixture.venue
    ? createVenue({
        id: fixture.venue.id,
        name: fixture.venue.name,
        ...(fixture.venue.address !== undefined ? { address: fixture.venue.address } : {}),
        ...(fixture.venue.neighborhood !== undefined ? { neighborhood: fixture.venue.neighborhood } : {}),
        city: fixture.venue.city ?? "Porto Alegre",
        state: fixture.venue.state ?? "RS",
        ...(fixture.venue.latitude !== undefined ? { latitude: fixture.venue.latitude } : {}),
        ...(fixture.venue.longitude !== undefined ? { longitude: fixture.venue.longitude } : {}),
      })
    : undefined;

  return createCanonicalEvent({
    id: fixture.id,
    slug: fixture.slug,
    title: fixture.title,
    ...(fixture.description !== undefined ? { description: fixture.description } : {}),
    ...(fixture.categoryId !== undefined ? { categoryId: fixture.categoryId } : {}),
    subcategories: fixture.subcategories ?? [],
    status: fixture.status ?? "scheduled",
    occurrences: [occurrence],
    ...(venue ? { venue } : {}),
    performers: fixture.performers ?? [],
    ...(fixture.price ? { price: { ...fixture.price, currency: "BRL" } } : {}),
    accessibility: [],
    ...(fixture.imageUrl !== undefined ? { imageUrl: fixture.imageUrl } : {}),
    ...(fixture.ticketUrl !== undefined ? { ticketUrl: fixture.ticketUrl } : {}),
    ...(fixture.canonicalUrl !== undefined ? { canonicalUrl: fixture.canonicalUrl } : {}),
    sources: [source],
    qualityScore: FIXTURE_QUALITY_SCORE,
    rankingScore: FIXTURE_RANKING_SCORE,
    firstSeenAt: FIXTURE_REFERENCE_INSTANT,
    lastSeenAt: FIXTURE_REFERENCE_INSTANT,
    createdAt: FIXTURE_REFERENCE_INSTANT,
    updatedAt: FIXTURE_REFERENCE_INSTANT,
  });
}

function buildOccurrence(fixture: OccurrenceFixture, id: string, eventId: string) {
  if (fixture.kind === "timed") {
    const startsAt = new Date(fixture.startsAt);
    return createTimedEventOccurrence({
      id,
      eventId,
      startsAt,
      ...(fixture.endsAt !== undefined ? { endsAt: new Date(fixture.endsAt) } : {}),
      status: "scheduled",
    });
  }

  return createDateOnlyEventOccurrence({
    id,
    eventId,
    startDate: fixture.startDate,
    ...(fixture.endDate !== undefined ? { endDate: fixture.endDate } : {}),
    status: "scheduled",
  });
}
