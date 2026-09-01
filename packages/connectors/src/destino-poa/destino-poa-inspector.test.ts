import { afterEach, describe, expect, it, vi } from "vitest";
import { inspectDestinoPOA } from "./destino-poa-inspector.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, { status, headers: { "content-type": "text/html" } });
}

describe("inspectDestinoPOA", () => {
  it("detects the html strategy and counts distinct event links, never persisting", async () => {
    const html = `
      <html><body>
        <a href="https://destinopoa.com.br/evento/evento-a/">Evento A</a>
        <a href="https://destinopoa.com.br/evento/evento-b/?utm=x">Evento B</a>
        <a href="https://destinopoa.com.br/evento/evento-a/">Evento A (duplicate link)</a>
      </body></html>
    `;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(htmlResponse(html)));

    const result = await inspectDestinoPOA();
    expect(result.status).toBe("ok");
    expect(result.strategyDetected).toBe("html");
    expect(result.eventsObserved).toBe(1); // only the exact-match URL counted twice collapses via Set
    expect(result.structuredDataDetected).toBe(false);
    expect(result.persisted).toBe(false);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("detects json-ld only when a block actually declares an Event type", async () => {
    const html = `<script type="application/ld+json">{"@type":"Event"}</script>`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(htmlResponse(html)));

    const result = await inspectDestinoPOA();
    expect(result.structuredDataDetected).toBe(true);
    expect(result.strategyDetected).toBe("json-ld");
  });

  // Regression guard for a real finding against the live site: generic SEO-plugin JSON-LD
  // (WebSite/SearchAction schema) is present, but is NOT Event data — must not be
  // misreported as "structured data detected" (see docs/sources/destino-poa.md).
  it("does not count generic non-Event JSON-LD (e.g. WebSite schema) as structured event data", async () => {
    const html = `
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"Destino POA"}]}</script>
      <a href="https://destinopoa.com.br/evento/some-event/">Some Event</a>
    `;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(htmlResponse(html)));

    const result = await inspectDestinoPOA();
    expect(result.structuredDataDetected).toBe(false);
    expect(result.strategyDetected).toBe("html");
  });

  it("reports unreachable on a non-ok HTTP response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(htmlResponse("", 503)));
    const result = await inspectDestinoPOA();
    expect(result.status).toBe("unreachable");
    expect(result.persisted).toBe(false);
  });

  it("reports unreachable on a network error, never throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await inspectDestinoPOA();
    expect(result.status).toBe("unreachable");
  });

  it("makes exactly one request — never follows individual event links", async () => {
    const fetchMock = vi.fn().mockResolvedValue(htmlResponse("<html></html>"));
    vi.stubGlobal("fetch", fetchMock);
    await inspectDestinoPOA();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
