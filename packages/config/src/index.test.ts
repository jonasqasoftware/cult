import { describe, expect, it } from "vitest";
import * as config from "./index.js";

describe("@cult/config public exports", () => {
  it("exposes env loading and the development source registry", () => {
    expect(typeof config.loadAppEnv).toBe("function");
    expect(typeof config.createDevelopmentSourceRegistry).toBe("function");
    expect(config.TICKETMASTER_SOURCE_DEFINITION.id).toBe("ticketmaster");
  });
});
