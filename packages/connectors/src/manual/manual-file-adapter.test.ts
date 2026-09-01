import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createManualFileAdapter, MANUAL_SOURCE_ID } from "./manual-file-adapter.js";
import type { ManualEventFeed } from "./manual-types.js";

describe("createManualFileAdapter", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "cult-manual-adapter-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("yields one RawSourceEvent per event in the file, tagged with the manual-beta source", async () => {
    const feed: ManualEventFeed = {
      events: [
        { id: "evt-1", title: "Evento Um", sourceUrl: "https://example.org/1" },
        { id: "evt-2", title: "Evento Dois", sourceUrl: "https://example.org/2" },
      ],
    };
    const filePath = path.join(dir, "events.json");
    await writeFile(filePath, JSON.stringify(feed), "utf8");

    const adapter = createManualFileAdapter({ filePath });
    const collected = [];
    for await (const rawEvent of adapter.collect({})) {
      collected.push(rawEvent);
    }

    expect(collected).toHaveLength(2);
    expect(collected[0]?.sourceId).toBe(MANUAL_SOURCE_ID);
    expect(collected[0]?.externalId).toBe("evt-1");
    expect(collected[0]?.payload).toEqual(feed.events[0]);
  });

  it("reports healthy", async () => {
    const filePath = path.join(dir, "events.json");
    await writeFile(filePath, JSON.stringify({ events: [] }), "utf8");
    const adapter = createManualFileAdapter({ filePath });
    const health = await adapter.healthCheck();
    expect(health.healthy).toBe(true);
  });
});
