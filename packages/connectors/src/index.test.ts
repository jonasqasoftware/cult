import { describe, expect, it } from "vitest";
import * as connectors from "./index.js";

describe("@cult/connectors public exports", () => {
  it("exposes the Ticketmaster client, adapter and normalizer through the package barrel", () => {
    expect(typeof connectors.createTicketmasterClient).toBe("function");
    expect(typeof connectors.createTicketmasterAdapter).toBe("function");
    expect(typeof connectors.createTicketmasterFixtureAdapter).toBe("function");
    expect(typeof connectors.normalizeTicketmasterEvent).toBe("function");
    expect(connectors.TICKETMASTER_SOURCE_ID).toBe("ticketmaster");
  });

  it("exposes the Destino POA fixture adapter, normalizer and inspector through the package barrel", () => {
    expect(typeof connectors.createDestinoPOAFixtureAdapter).toBe("function");
    expect(typeof connectors.normalizeDestinoPOAEvent).toBe("function");
    expect(typeof connectors.inspectDestinoPOA).toBe("function");
    expect(connectors.DESTINO_POA_SOURCE_ID).toBe("destino-poa");
  });
});
