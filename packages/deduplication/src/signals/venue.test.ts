import { describe, expect, it } from "vitest";
import { assessVenueText } from "./venue.js";
import type { Venue } from "@cult/domain";

function venue(overrides: Partial<Venue> & { name: string }): Venue {
  return { id: "x", city: "Porto Alegre", state: "RS", country: "BR", ...overrides };
}

describe("assessVenueText", () => {
  it("is undefined when either side has no venue", () => {
    expect(assessVenueText(undefined, venue({ name: "Teatro São Pedro" }))).toBeUndefined();
    expect(assessVenueText(venue({ name: "Teatro São Pedro" }), undefined)).toBeUndefined();
  });

  it("is high for an identical venue name", () => {
    const result = assessVenueText(venue({ name: "Teatro São Pedro" }), venue({ name: "Teatro São Pedro" }));
    expect(result).toBe(1);
  });

  it("is high for a shortened/abbreviated venue name", () => {
    const result = assessVenueText(
      venue({ name: "Auditório Araújo Vianna" }),
      venue({ name: "Araújo Vianna" }),
    );
    expect(result).toBeGreaterThanOrEqual(0.9);
  });

  it("is low for a clearly different venue name", () => {
    const result = assessVenueText(venue({ name: "Usina do Gasômetro" }), venue({ name: "Cinemateca Capitólio" }));
    expect(result).toBeLessThan(0.3);
  });

  it("gives a small boost when the address also matches", () => {
    const withoutAddress = assessVenueText(venue({ name: "Praça da Alfândega" }), venue({ name: "Praça da Alfândega" }));
    const withAddress = assessVenueText(
      venue({ name: "Praça da Alfândega", address: "Praça da Alfândega, s/n - Centro Histórico" }),
      venue({ name: "Praça da Alfândega", address: "Praça da Alfândega, s/n - Centro Histórico" }),
    );
    expect(withAddress).toBeGreaterThanOrEqual(withoutAddress ?? 0);
  });
});
