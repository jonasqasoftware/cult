import { afterAll, describe, expect, it } from "vitest";
import { ping } from "./ping.js";
import { connectTestDatabase } from "./test-support.js";

const connection = connectTestDatabase();

afterAll(async () => {
  await connection.close();
});

describe("ping", () => {
  it("resolves when the database is reachable", async () => {
    await expect(ping(connection.db)).resolves.toBeUndefined();
  });
});
