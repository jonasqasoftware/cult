import { describe, expect, it } from "vitest";
import { computeScore } from "./score.js";

describe("computeScore", () => {
  it("is 1 when every available signal is a perfect match", () => {
    const score = computeScore({ title: 1, venue: 1, temporal: 1, geo: 1, performer: 1 });
    expect(score).toBe(1);
  });

  it("is 0 when every available signal is a total mismatch", () => {
    const score = computeScore({ title: 0, venue: 0, temporal: 0, geo: 0, performer: 0 });
    expect(score).toBe(0);
  });

  it("stays bounded between 0 and 1", () => {
    const score = computeScore({ title: 0.7, venue: 0.9, temporal: 1, url: 1 });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("renormalizes weights when a signal is missing, rather than treating it as 0", () => {
    const withoutVenue = computeScore({ title: 1, temporal: 1 });
    expect(withoutVenue).toBe(1);
  });

  it("does not let a missing performer signal drag the score down", () => {
    const withPerformer = computeScore({ title: 1, venue: 1, temporal: 1, performer: 1 });
    const withoutPerformer = computeScore({ title: 1, venue: 1, temporal: 1 });
    expect(withoutPerformer).toBeCloseTo(withPerformer, 5);
  });

  it("gives a small corroborating boost for a matching URL, capped at 1", () => {
    const withoutUrl = computeScore({ title: 0.9, venue: 0.9, temporal: 0.9 });
    const withMatchingUrl = computeScore({ title: 0.9, venue: 0.9, temporal: 0.9, url: 1 });
    expect(withMatchingUrl).toBeGreaterThan(withoutUrl);
    expect(withMatchingUrl).toBeLessThanOrEqual(1);
  });

  it("never penalizes a non-matching URL — same score with or without it", () => {
    const withoutUrl = computeScore({ title: 0.9, venue: 0.9, temporal: 0.9 });
    const withDifferentUrl = computeScore({ title: 0.9, venue: 0.9, temporal: 0.9, url: 0 });
    expect(withDifferentUrl).toBeCloseTo(withoutUrl, 5);
  });

  it("is deterministic for the same input", () => {
    const input = { title: 0.6, venue: 0.4, temporal: 0.9, geo: 0.2, performer: 0.5 };
    expect(computeScore(input)).toBe(computeScore(input));
  });
});
