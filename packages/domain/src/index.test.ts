import { describe, expect, it } from "vitest";
import * as domain from "./index.js";

describe("@cult/domain public exports", () => {
  it("exposes the domain factories and ports through the package barrel", () => {
    expect(typeof domain.createCanonicalEvent).toBe("function");
    expect(typeof domain.createEventOccurrence).toBe("function");
    expect(typeof domain.createVenue).toBe("function");
    expect(typeof domain.createSourceDefinition).toBe("function");
    expect(typeof domain.createEventSourceReference).toBe("function");
    expect(typeof domain.createInMemorySourceRegistry).toBe("function");
    expect(typeof domain.DomainValidationError).toBe("function");
  });
});
