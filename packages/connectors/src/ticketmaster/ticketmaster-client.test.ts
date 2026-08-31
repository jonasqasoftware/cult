import { afterEach, describe, expect, it, vi } from "vitest";
import { createTicketmasterClient } from "./ticketmaster-client.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("createTicketmasterClient", () => {
  it("builds the request with apikey, countryCode, city, page and size", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ _embedded: { events: [] }, page: { totalPages: 1 } }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createTicketmasterClient({
      apiKey: "secret-key",
      baseUrl: "https://example.invalid/discovery/v2/",
      minRequestIntervalMs: 0,
    });
    await client.searchEvents({ countryCode: "BR", city: "Porto Alegre", page: 2, size: 10 });

    const requestUrl = new URL(fetchMock.mock.calls[0]?.[0] as string | URL);
    expect(requestUrl.origin + requestUrl.pathname).toBe(
      "https://example.invalid/discovery/v2/events.json",
    );
    expect(requestUrl.searchParams.get("apikey")).toBe("secret-key");
    expect(requestUrl.searchParams.get("countryCode")).toBe("BR");
    expect(requestUrl.searchParams.get("city")).toBe("Porto Alegre");
    expect(requestUrl.searchParams.get("page")).toBe("2");
    expect(requestUrl.searchParams.get("size")).toBe("10");
  });

  it("never includes the api key in a thrown error's message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 401)));
    const client = createTicketmasterClient({ apiKey: "super-secret-key", minRequestIntervalMs: 0 });

    let caught: unknown;
    try {
      await client.searchEvents({ countryCode: "BR", city: "Porto Alegre" });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    expect(String(caught)).not.toContain("super-secret-key");
  });

  it("treats 401 as unauthorized", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 401)));
    const client = createTicketmasterClient({ apiKey: "k", minRequestIntervalMs: 0 });
    await expect(client.searchEvents({ countryCode: "BR", city: "Porto Alegre" })).rejects.toMatchObject(
      { kind: "unauthorized", status: 401 },
    );
  });

  it("treats 429 as rate_limited", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 429)));
    const client = createTicketmasterClient({ apiKey: "k", minRequestIntervalMs: 0 });
    await expect(client.searchEvents({ countryCode: "BR", city: "Porto Alegre" })).rejects.toMatchObject(
      { kind: "rate_limited", status: 429 },
    );
  });

  it("treats a 5xx response as server_error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 503)));
    const client = createTicketmasterClient({ apiKey: "k", minRequestIntervalMs: 0 });
    await expect(client.searchEvents({ countryCode: "BR", city: "Porto Alegre" })).rejects.toMatchObject(
      { kind: "server_error", status: 503 },
    );
  });

  it("treats an aborted request as a timeout", async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, options: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createTicketmasterClient({ apiKey: "k", timeoutMs: 5, minRequestIntervalMs: 0 });
    await expect(client.searchEvents({ countryCode: "BR", city: "Porto Alegre" })).rejects.toMatchObject(
      { kind: "timeout" },
    );
  });
});
