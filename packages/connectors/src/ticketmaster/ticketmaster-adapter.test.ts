import { afterEach, describe, expect, it, vi } from "vitest";
import { createTicketmasterAdapter, TICKETMASTER_SOURCE_ID } from "./ticketmaster-adapter.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const sampleEvent = {
  id: "TM-1",
  name: "Show de Teste",
  url: "https://www.ticketmaster.com/event/tm-1",
  dates: { start: { dateTime: "2026-10-01T22:00:00Z" }, status: { code: "onsale" } },
};

describe("createTicketmasterAdapter", () => {
  it("produces RawSourceEvent with the correct sourceId and payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ _embedded: { events: [sampleEvent] }, page: { totalPages: 1, number: 0 } }),
        ),
    );

    const adapter = createTicketmasterAdapter({ apiKey: "k", minRequestIntervalMs: 0 });
    const collected = [];
    for await (const raw of adapter.collect({})) {
      collected.push(raw);
    }

    expect(collected).toHaveLength(1);
    expect(collected[0]?.sourceId).toBe(TICKETMASTER_SOURCE_ID);
    expect(collected[0]?.externalId).toBe("TM-1");
    expect(collected[0]?.payload).toEqual(sampleEvent);
  });

  it("produces a deterministic contentHash for the same payload", async () => {
    const response = jsonResponse({
      _embedded: { events: [sampleEvent] },
      page: { totalPages: 1, number: 0 },
    });
    const responseClone = response.clone();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response));
    const firstAdapter = createTicketmasterAdapter({ apiKey: "k", minRequestIntervalMs: 0 });
    const first = [];
    for await (const raw of firstAdapter.collect({})) first.push(raw);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(responseClone));
    const secondAdapter = createTicketmasterAdapter({ apiKey: "k", minRequestIntervalMs: 0 });
    const second = [];
    for await (const raw of secondAdapter.collect({})) second.push(raw);

    expect(first[0]?.contentHash).toBe(second[0]?.contentHash);
    // ids are randomly generated per collection — hash determinism is about payload content
    expect(first[0]?.id).not.toBe(second[0]?.id);
  });

  it("stops paginating once totalPages is reached", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          _embedded: { events: [{ ...sampleEvent, id: "TM-1" }] },
          page: { totalPages: 2, number: 0 },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          _embedded: { events: [{ ...sampleEvent, id: "TM-2" }] },
          page: { totalPages: 2, number: 1 },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createTicketmasterAdapter({ apiKey: "k", minRequestIntervalMs: 0 });
    const collected = [];
    for await (const raw of adapter.collect({})) {
      collected.push(raw);
    }

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(collected.map((e) => e.externalId)).toEqual(["TM-1", "TM-2"]);
  });

  it("stops paginating when a page returns no events, even if totalPages implies more", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ _embedded: { events: [] }, page: { totalPages: 5, number: 0 } }));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createTicketmasterAdapter({ apiKey: "k", minRequestIntervalMs: 0 });
    const collected = [];
    for await (const raw of adapter.collect({})) {
      collected.push(raw);
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(collected).toHaveLength(0);
  });
});
