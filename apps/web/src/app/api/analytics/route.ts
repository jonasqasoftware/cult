import { NextResponse, type NextRequest } from "next/server";
import { validateAnalyticsEvent } from "@cult/domain";
import { getCultApiBaseUrl } from "../../../lib/api/env";

// M10 sections 25-28 — the first-party BFF the browser actually calls. Not a generic proxy:
// only ever forwards a validated {event_name, event_id?, metadata} shape it has already
// checked against the exact same allowlist the private API enforces again on its own side
// (defense in depth, one shared rule — see @cult/domain's validateAnalyticsEvent).
const MAX_BODY_BYTES = 4096;

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const input = (body ?? {}) as Record<string, unknown>;
  const eventIdRaw = input["event_id"];
  const validation = validateAnalyticsEvent({
    eventName: typeof input["event_name"] === "string" ? input["event_name"] : "",
    ...(eventIdRaw !== undefined ? { eventId: eventIdRaw as string } : {}),
    metadata: input["metadata"] && typeof input["metadata"] === "object" ? (input["metadata"] as Record<string, unknown>) : {},
  });

  if (!validation.valid) {
    return NextResponse.json({ error: validation.reason }, { status: 400 });
  }

  // Best-effort forward — analytics must never block the product (section 29). The browser
  // call that reaches this route is itself fire-and-forget (lib/analytics/track.ts) and
  // never awaits/reacts to the response, so a failure here is swallowed rather than surfaced.
  try {
    await fetch(new URL("/v1/analytics", getCultApiBaseUrl()), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event_name: validation.eventName,
        ...(validation.eventId !== undefined ? { event_id: validation.eventId } : {}),
        metadata: validation.metadata,
      }),
    });
  } catch {
    // Swallowed — see comment above. The private API's own request logging is the record
    // of a failure here, not this response.
  }

  return NextResponse.json({ status: "accepted" }, { status: 202 });
}
