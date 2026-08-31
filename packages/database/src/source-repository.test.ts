import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createSourceDefinition } from "@cult/domain";
import { sources } from "./schema.js";
import { upsertSource } from "./source-repository.js";
import { connectTestDatabase, truncateAllTables } from "./test-support.js";

const connection = connectTestDatabase();

beforeEach(async () => {
  await truncateAllTables(connection);
});

afterAll(async () => {
  await connection.close();
});

describe("upsertSource", () => {
  const base = createSourceDefinition({
    id: "src-1",
    name: "Src",
    type: "api",
    enabled: true,
    pollingIntervalMinutes: 30,
    authorityScore: 0.7,
    commercialUse: "restricted",
    connector: "x",
  });

  it("inserts a new source", async () => {
    await upsertSource(connection.db, base);
    const rows = await connection.db.select().from(sources).where(eq(sources.id, "src-1"));
    expect(rows[0]?.commercialUse).toBe("restricted");
  });

  it("updates an existing source on conflict", async () => {
    await upsertSource(connection.db, base);
    await upsertSource(connection.db, { ...base, enabled: false, authorityScore: 0.3 });
    const rows = await connection.db.select().from(sources).where(eq(sources.id, "src-1"));
    expect(rows[0]?.enabled).toBe(false);
    expect(rows[0]?.authorityScore).toBe(0.3);
  });
});
