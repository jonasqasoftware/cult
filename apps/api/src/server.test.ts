import { describe, expect, it } from "vitest";
import { buildServer } from "./server.js";

describe("apps/api health skeleton", () => {
  it("GET /health returns 200 ok", async () => {
    const app = buildServer();
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("GET /ready returns 200 ready", async () => {
    const app = buildServer();
    const response = await app.inject({ method: "GET", url: "/ready" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ready" });
  });
});
