import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createDestinoPOAFixtureAdapter,
  destinoPOAEventToRawSourceEvent,
  DESTINO_POA_SOURCE_ID,
} from "./destino-poa-fixture-adapter.js";

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../test-data/golden-events/destino-poa/agenda-feed.json",
);

describe("createDestinoPOAFixtureAdapter", () => {
  it("yields RawSourceEvent entries from the fixture file without any network call", async () => {
    const adapter = createDestinoPOAFixtureAdapter({ fixturePath });
    const collected = [];
    for await (const raw of adapter.collect({})) {
      collected.push(raw);
    }

    expect(adapter.sourceId).toBe(DESTINO_POA_SOURCE_ID);
    expect(collected.length).toBe(10);
    expect(collected.every((event) => event.sourceId === DESTINO_POA_SOURCE_ID)).toBe(true);
    expect(collected.map((event) => event.externalId)).toContain("virada-cultural-porto-alegre-2026");
  });

  it("always reports healthy (a local file is always available)", async () => {
    const adapter = createDestinoPOAFixtureAdapter({ fixturePath });
    const health = await adapter.healthCheck();
    expect(health.healthy).toBe(true);
  });
});

describe("destinoPOAEventToRawSourceEvent", () => {
  it("produces a deterministic contentHash regardless of key order", () => {
    const a = destinoPOAEventToRawSourceEvent({ id: "x", title: "Show" });
    const b = destinoPOAEventToRawSourceEvent({ title: "Show", id: "x" });
    expect(a.contentHash).toBe(b.contentHash);
  });

  it("treats a missing id/url as no externalId, never a literal 'undefined'", () => {
    const raw = destinoPOAEventToRawSourceEvent({ title: "Sem identificador" });
    expect(raw.externalId).toBeUndefined();
    expect(raw.sourceUrl).not.toContain("undefined");
  });

  it("extracts externalId from the url slug when id is absent", () => {
    const raw = destinoPOAEventToRawSourceEvent({
      title: "Evento",
      url: "https://destinopoa.com.br/evento/meu-evento-2026/",
    });
    expect(raw.externalId).toBe("meu-evento-2026");
  });
});
