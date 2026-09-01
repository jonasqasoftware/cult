// Bounded, read-only live discovery spike against the real Destino POA site. This is NOT an
// EventSourcePort implementation and cannot feed the ingestion pipeline — it only ever
// reports counts/strategy, never persists anything (see M3 report: live persistence for
// this source is blocked entirely, not just gated). Used by `pnpm inspect:destino-poa`.
export interface DestinoPOAInspectionResult {
  readonly status: "ok" | "unreachable";
  readonly strategyDetected: "json-ld" | "wp-json" | "html" | "unknown";
  readonly eventsObserved: number;
  readonly structuredDataDetected: boolean;
  readonly durationMs: number;
  readonly persisted: false;
}

export interface InspectDestinoPOAConfig {
  readonly agendaUrl?: string;
  readonly timeoutMs?: number;
  readonly maxResponseBytes?: number;
}

const DEFAULT_AGENDA_URL = "https://destinopoa.com.br/agenda/";
const DEFAULT_TIMEOUT_MS = 8000;
// Bounded response size — this is a discovery probe, not a crawler. One request, one page,
// capped bytes; never follows pagination or individual event links.
const DEFAULT_MAX_RESPONSE_BYTES = 2_000_000;
const USER_AGENT = "CULT-DiscoverySpike/0.1 (+https://github.com/jonasqasoftware/cult; read-only)";

export async function inspectDestinoPOA(
  config: InspectDestinoPOAConfig = {},
): Promise<DestinoPOAInspectionResult> {
  const agendaUrl = config.agendaUrl ?? DEFAULT_AGENDA_URL;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxResponseBytes = config.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;

  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(agendaUrl, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
    });

    if (!response.ok) {
      return unreachable(startedAt);
    }

    const html = await readBounded(response, maxResponseBytes);
    // Presence of a <script type="application/ld+json"> tag alone is NOT enough — real-world
    // check found this site's JSON-LD is generic SEO-plugin site/WebSite schema, not Event
    // data. Only count it as "structured event data" if a block actually declares an Event.
    const structuredDataDetected = Array.from(
      html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
    ).some((match) => /"@type"\s*:\s*"Event"/i.test(match[1] ?? ""));
    const eventLinks = new Set(
      Array.from(html.matchAll(/href="(https:\/\/destinopoa\.com\.br\/evento\/[^"?#]+\/?)"/gi)).map(
        (match) => match[1],
      ),
    );

    let strategyDetected: DestinoPOAInspectionResult["strategyDetected"] = "unknown";
    if (structuredDataDetected) strategyDetected = "json-ld";
    else if (eventLinks.size > 0) strategyDetected = "html";

    return {
      status: "ok",
      strategyDetected,
      eventsObserved: eventLinks.size,
      structuredDataDetected,
      durationMs: Date.now() - startedAt,
      persisted: false,
    };
  } catch {
    return unreachable(startedAt);
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function unreachable(startedAt: number): DestinoPOAInspectionResult {
  return {
    status: "unreachable",
    strategyDetected: "unknown",
    eventsObserved: 0,
    structuredDataDetected: false,
    durationMs: Date.now() - startedAt,
    persisted: false,
  };
}

async function readBounded(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return response.text();

  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      received += value.byteLength;
      chunks.push(value);
      if (received >= maxBytes) {
        await reader.cancel();
        break;
      }
    }
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
}
