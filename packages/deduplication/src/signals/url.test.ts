import { describe, expect, it } from "vitest";
import { assessUrl } from "./url.js";
import type { CanonicalEvent } from "@cult/domain";

function eventWithUrls(ticketUrl?: string, canonicalUrl?: string): Pick<CanonicalEvent, "ticketUrl" | "canonicalUrl"> {
  return { ...(ticketUrl ? { ticketUrl } : {}), ...(canonicalUrl ? { canonicalUrl } : {}) };
}

describe("assessUrl", () => {
  it("is undefined when neither side has a comparable URL", () => {
    expect(assessUrl(eventWithUrls(), eventWithUrls())).toBeUndefined();
  });

  it("is undefined when only one side has a URL", () => {
    expect(assessUrl(eventWithUrls("https://example.invalid/a"), eventWithUrls())).toBeUndefined();
  });

  it("is 1 for an exactly shared ticket URL", () => {
    const url = "https://example.invalid/festival-jazz-guaiba";
    expect(assessUrl(eventWithUrls(url), eventWithUrls(url))).toBe(1);
  });

  it("is insensitive to a trailing slash", () => {
    expect(
      assessUrl(eventWithUrls("https://example.invalid/a"), eventWithUrls("https://example.invalid/a/")),
    ).toBe(1);
  });

  it("is 0 for two different URLs (not a penalty, just a non-match signal)", () => {
    expect(
      assessUrl(eventWithUrls("https://example.invalid/a"), eventWithUrls("https://example.invalid/b")),
    ).toBe(0);
  });

  it("also compares canonicalUrl when ticketUrl is not present on both sides", () => {
    const url = "https://example.invalid/canonical-a";
    expect(assessUrl({ canonicalUrl: url }, { canonicalUrl: url })).toBe(1);
  });
});
