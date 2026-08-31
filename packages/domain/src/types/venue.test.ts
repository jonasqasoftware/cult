import { describe, expect, it } from "vitest";
import { createVenue } from "./venue.js";

describe("createVenue", () => {
  const base = {
    id: "venue-1",
    name: "Teatro São Pedro",
    city: "Porto Alegre",
    state: "RS",
  };

  it("allows a venue without coordinates", () => {
    const venue = createVenue(base);
    expect(venue.country).toBe("BR");
    expect(venue.latitude).toBeUndefined();
    expect(venue.longitude).toBeUndefined();
  });

  it("accepts valid latitude and longitude", () => {
    const venue = createVenue({ ...base, latitude: -30.03, longitude: -51.23 });
    expect(venue.latitude).toBe(-30.03);
    expect(venue.longitude).toBe(-51.23);
  });

  it("rejects latitude outside -90..90", () => {
    expect(() => createVenue({ ...base, latitude: 91 })).toThrow(/latitude/);
    expect(() => createVenue({ ...base, latitude: -91 })).toThrow(/latitude/);
  });

  it("rejects longitude outside -180..180", () => {
    expect(() => createVenue({ ...base, longitude: 181 })).toThrow(/longitude/);
    expect(() => createVenue({ ...base, longitude: -181 })).toThrow(/longitude/);
  });
});
