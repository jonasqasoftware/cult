import { describe, expect, it } from "vitest";
import * as database from "./index.js";

describe("@cult/database public exports", () => {
  it("exposes the connection factory and repository factories through the package barrel", () => {
    expect(typeof database.createDatabaseConnection).toBe("function");
    expect(typeof database.createRawEventRepository).toBe("function");
    expect(typeof database.createCanonicalEventRepository).toBe("function");
    expect(typeof database.loadCanonicalEventsByIds).toBe("function");
    expect(typeof database.upsertSource).toBe("function");
  });

  it("exposes the M7 discovery query layer", () => {
    expect(typeof database.discoverEvents).toBe("function");
    expect(typeof database.resolvePeriod).toBe("function");
    expect(typeof database.resolveDateRangeFilter).toBe("function");
    expect(typeof database.encodeCursor).toBe("function");
    expect(typeof database.decodeCursor).toBe("function");
  });
});
