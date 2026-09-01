import { describe, expect, it } from "vitest";
import { buildEventJsonLd } from "./event-jsonld.js";
import type { CultEvent } from "../api/types.js";

const BASE_EVENT: CultEvent = {
  id: "evt-1",
  slug: "show-de-jazz",
  title: "Show de Jazz",
  description: "Uma noite de jazz.",
  status: "scheduled",
  category: "music",
  occurrences: [],
  venue: {
    name: "Teatro Exemplo",
    address: "Rua Exemplo, 123",
    neighborhood: "Centro",
    city: "Porto Alegre",
    state: "RS",
    country: "BR",
    latitude: -30.03,
    longitude: -51.21,
  },
  free: false,
  price_min: 50,
  price_max: 50,
  currency: "BRL",
  image_url: "https://example.org/image.jpg",
  ticket_url: "https://example.org/tickets",
  sources: [],
};

describe("buildEventJsonLd — timed occurrence", () => {
  it("uses the ISO instant as startDate, never a fabricated date-only value", () => {
    const event: CultEvent = {
      ...BASE_EVENT,
      occurrences: [
        { kind: "timed", starts_at: "2026-09-20T23:00:00Z", ends_at: null, timezone: "America/Sao_Paulo", status: "scheduled" },
      ],
    };
    const jsonLd = buildEventJsonLd(event, "https://cult.example/eventos/show-de-jazz");
    expect(jsonLd["@type"]).toBe("Event");
    expect(jsonLd.startDate).toBe("2026-09-20T23:00:00Z");
    expect(jsonLd.endDate).toBeUndefined();
  });
});

describe("buildEventJsonLd — date-only occurrence", () => {
  it("uses the plain YYYY-MM-DD string as startDate — never converts it to an instant", () => {
    const event: CultEvent = {
      ...BASE_EVENT,
      occurrences: [{ kind: "date", start_date: "2026-09-20", end_date: null, timezone: "America/Sao_Paulo", status: "scheduled" }],
    };
    const jsonLd = buildEventJsonLd(event, "https://cult.example/eventos/show-de-jazz");
    expect(jsonLd.startDate).toBe("2026-09-20");
    expect(jsonLd.startDate).not.toContain("T");
  });

  it("includes endDate as a plain date for a range, never inventing a time", () => {
    const event: CultEvent = {
      ...BASE_EVENT,
      occurrences: [{ kind: "date", start_date: "2026-09-01", end_date: "2026-09-30", timezone: "America/Sao_Paulo", status: "scheduled" }],
    };
    const jsonLd = buildEventJsonLd(event, "https://cult.example/eventos/show-de-jazz");
    expect(jsonLd.startDate).toBe("2026-09-01");
    expect(jsonLd.endDate).toBe("2026-09-30");
  });
});

describe("buildEventJsonLd — status mapping", () => {
  it("maps cancelled to schema.org's EventCancelled", () => {
    const event: CultEvent = { ...BASE_EVENT, status: "cancelled" };
    expect(buildEventJsonLd(event, "https://cult.example/eventos/x").eventStatus).toBe(
      "https://schema.org/EventCancelled",
    );
  });

  it("omits eventStatus for a status with no correct schema.org mapping, rather than guessing", () => {
    const event: CultEvent = { ...BASE_EVENT, status: "completed" };
    expect(buildEventJsonLd(event, "https://cult.example/eventos/x").eventStatus).toBeUndefined();
  });
});

describe("buildEventJsonLd — safety", () => {
  it("never includes internal/provisional fields", () => {
    const jsonLd = buildEventJsonLd(BASE_EVENT, "https://cult.example/eventos/show-de-jazz");
    const serialized = JSON.stringify(jsonLd);
    expect(serialized).not.toContain("quality_score");
    expect(serialized).not.toContain("ranking_score");
    expect(serialized).not.toContain("confidence");
  });

  it("includes location built from the venue when present", () => {
    const jsonLd = buildEventJsonLd(BASE_EVENT, "https://cult.example/eventos/show-de-jazz");
    expect(jsonLd.location?.["@type"]).toBe("Place");
    expect(jsonLd.location?.name).toBe("Teatro Exemplo");
  });

  it("omits location when there is no venue", () => {
    const event: CultEvent = { ...BASE_EVENT, venue: null };
    const jsonLd = buildEventJsonLd(event, "https://cult.example/eventos/show-de-jazz");
    expect(jsonLd.location).toBeUndefined();
  });
});
