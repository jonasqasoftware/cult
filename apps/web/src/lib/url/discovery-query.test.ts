import { describe, expect, it } from "vitest";
import { buildDiscoveryHref, searchParamsToFilters } from "./discovery-query.js";

describe("buildDiscoveryHref", () => {
  it("builds a plain '/' for no filters", () => {
    expect(buildDiscoveryHref({})).toBe("/");
  });

  it("reflects a period filter in the URL", () => {
    expect(buildDiscoveryHref({ period: "today" })).toBe("/?period=today");
  });

  it("reflects free=true in the URL", () => {
    expect(buildDiscoveryHref({ free: true })).toBe("/?free=true");
  });

  it("reflects a search term and category together, in a stable order", () => {
    expect(buildDiscoveryHref({ q: "jazz", category: "music" })).toBe("/?q=jazz&category=music");
  });

  it("omits cursor by default (toggling a filter should not carry over pagination state)", () => {
    expect(buildDiscoveryHref({ period: "today", cursor: "abc" }, { includeCursor: false })).toBe(
      "/?period=today",
    );
  });

  it("includes cursor when explicitly requested (used by 'load more')", () => {
    expect(buildDiscoveryHref({ period: "today", cursor: "abc" }, { includeCursor: true })).toBe(
      "/?period=today&cursor=abc",
    );
  });

  it("rounds lat/lng to a coarse precision suitable for an urban-scale query, never full precision", () => {
    const href = buildDiscoveryHref({ lat: -30.03461234, lng: -51.21771234, radius: 5000 });
    expect(href).toBe("/?lat=-30.0346&lng=-51.2177&radius=5000");
  });
});

describe("searchParamsToFilters", () => {
  it("returns an empty filter set for empty search params", () => {
    expect(searchParamsToFilters({})).toEqual({});
  });

  it("parses a period value", () => {
    expect(searchParamsToFilters({ period: "weekend" })).toEqual({ period: "weekend" });
  });

  it("ignores an invalid period rather than passing it through blindly", () => {
    expect(searchParamsToFilters({ period: "not-a-period" })).toEqual({});
  });

  it("parses free=true/false and ignores a malformed value", () => {
    expect(searchParamsToFilters({ free: "true" })).toEqual({ free: true });
    expect(searchParamsToFilters({ free: "false" })).toEqual({ free: false });
    expect(searchParamsToFilters({ free: "yes" })).toEqual({});
  });

  it("parses q, category, and cursor as plain strings", () => {
    expect(searchParamsToFilters({ q: "jazz", category: "music", cursor: "abc" })).toEqual({
      q: "jazz",
      category: "music",
      cursor: "abc",
    });
  });

  it("parses lat/lng/radius as numbers, requiring lat and lng together", () => {
    expect(searchParamsToFilters({ lat: "-30.03", lng: "-51.21", radius: "3000" })).toEqual({
      lat: -30.03,
      lng: -51.21,
      radius: 3000,
    });
    expect(searchParamsToFilters({ lat: "-30.03" })).toEqual({});
  });

  it("takes the first value when Next hands back an array for a repeated param", () => {
    expect(searchParamsToFilters({ q: ["jazz", "rock"] })).toEqual({ q: "jazz" });
  });
});
