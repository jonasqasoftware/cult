import { describe, expect, it } from "vitest";
import { checkLiveIngestionAllowed } from "./live-ingestion-gate.js";

const baseEnv = {
  nodeEnv: "test",
  databaseUrl: "postgresql://x",
  apiPort: 3001,
  ticketmasterLivePersistAck: false,
} as const;

describe("checkLiveIngestionAllowed", () => {
  it("blocks when no API key is present", () => {
    const result = checkLiveIngestionAllowed({ ...baseEnv, ticketmasterLivePersistAck: true });
    expect(result.allowed).toBe(false);
    if (result.allowed) return;
    expect(result.reason).toMatch(/TICKETMASTER_API_KEY/);
  });

  it("blocks a persisting run when retention has not been acknowledged, even with an API key", () => {
    const result = checkLiveIngestionAllowed({
      ...baseEnv,
      ticketmasterApiKey: "k",
      ticketmasterLivePersistAck: false,
    });
    expect(result.allowed).toBe(false);
    if (result.allowed) return;
    expect(result.reason).toMatch(/retention|ADR-0013|TICKETMASTER_LIVE_PERSIST_ACK/i);
  });

  it("allows a persisting run only once both an API key and the retention ack are present", () => {
    const result = checkLiveIngestionAllowed({
      ...baseEnv,
      ticketmasterApiKey: "k",
      ticketmasterLivePersistAck: true,
    });
    expect(result.allowed).toBe(true);
    if (!result.allowed) return;
    expect(result.apiKey).toBe("k");
  });
});
