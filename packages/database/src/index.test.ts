import { describe, expect, it } from "vitest";
import * as database from "./index.js";

describe("@cult/database public exports", () => {
  it("exposes the connection factory and repository factories through the package barrel", () => {
    expect(typeof database.createDatabaseConnection).toBe("function");
    expect(typeof database.createRawEventRepository).toBe("function");
    expect(typeof database.createCanonicalEventRepository).toBe("function");
    expect(typeof database.listCanonicalEvents).toBe("function");
    expect(typeof database.upsertSource).toBe("function");
  });
});
