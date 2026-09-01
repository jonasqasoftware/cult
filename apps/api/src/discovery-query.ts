import { EVENT_STATUSES, type EventStatus } from "@cult/domain";
import { resolveDateRangeFilter, type DiscoveryGeoFilter, type DiscoveryQuery } from "@cult/database";

export type DiscoveryQueryError =
  | "invalid-date"
  | "invalid-period"
  | "invalid-location"
  | "invalid-radius"
  | "invalid-filter-combination"
  | "invalid-limit"
  | "invalid-query-parameter";

export type ParsedDiscoveryQuery =
  | { readonly ok: true; readonly value: DiscoveryQuery }
  | { readonly ok: false; readonly error: DiscoveryQueryError; readonly detail: string };

const LIMIT_DEFAULT = 20;
const LIMIT_MAX = 100;
const RADIUS_DEFAULT_METERS = 5000;
const RADIUS_MIN_METERS = 1;
const RADIUS_MAX_METERS = 50000;

function fail(error: DiscoveryQueryError, detail: string): ParsedDiscoveryQuery {
  return { ok: false, error, detail };
}

function stringParam(raw: Record<string, unknown>, name: string): string | undefined {
  return typeof raw[name] === "string" ? (raw[name] as string) : undefined;
}

// Turns raw, possibly-invalid Fastify query-string values into the already-validated
// DiscoveryQuery the query layer (@cult/database) expects — every Problem Details 400 in the
// route comes from this function, not from ad hoc checks scattered across server.ts (section
// 34: keep SQL, and the validation that guards it, out of the route body).
export function parseDiscoveryQuery(raw: Record<string, unknown>, now: Date): ParsedDiscoveryQuery {
  const limitRaw = raw["limit"];
  const limit = limitRaw !== undefined ? Number(limitRaw) : LIMIT_DEFAULT;
  if (!Number.isInteger(limit) || limit < 1 || limit > LIMIT_MAX) {
    return fail("invalid-limit", `limit must be an integer between 1 and ${LIMIT_MAX}`);
  }

  const period = stringParam(raw, "period");
  const start = stringParam(raw, "start");
  const end = stringParam(raw, "end");
  const rangeResult = resolveDateRangeFilter(
    {
      ...(period !== undefined ? { period } : {}),
      ...(start !== undefined ? { start } : {}),
      ...(end !== undefined ? { end } : {}),
    },
    now,
  );
  if (!rangeResult.ok) {
    return fail(rangeResult.error, dateRangeErrorDetail(rangeResult.error));
  }

  let free: boolean | undefined;
  if (raw["free"] !== undefined) {
    if (raw["free"] === "true") free = true;
    else if (raw["free"] === "false") free = false;
    else return fail("invalid-query-parameter", "free must be 'true' or 'false'");
  }

  let status: EventStatus | undefined;
  const statusRaw = stringParam(raw, "status");
  if (statusRaw !== undefined) {
    if (!(EVENT_STATUSES as readonly string[]).includes(statusRaw)) {
      return fail("invalid-query-parameter", `status must be one of ${EVENT_STATUSES.join(", ")}`);
    }
    status = statusRaw as EventStatus;
  }

  const geoResult = parseGeo(raw);
  if (!geoResult.ok) return geoResult;

  const category = stringParam(raw, "category");
  const q = stringParam(raw, "q");
  const cursor = stringParam(raw, "cursor");

  return {
    ok: true,
    value: {
      limit,
      ...(rangeResult.range ? { dateRange: rangeResult.range } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(q !== undefined ? { q } : {}),
      ...(free !== undefined ? { free } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(geoResult.geo ? { geo: geoResult.geo } : {}),
      ...(cursor !== undefined ? { cursor } : {}),
    },
  };
}

function dateRangeErrorDetail(error: "invalid-period" | "invalid-date" | "invalid-filter-combination"): string {
  switch (error) {
    case "invalid-period":
      return "period must be one of today, tomorrow, weekend, this_week, this_month";
    case "invalid-date":
      return "start/end must be valid YYYY-MM-DD calendar dates with start <= end";
    case "invalid-filter-combination":
      return "period cannot be combined with start/end, and start/end must be given together";
  }
}

type GeoParseResult = { readonly ok: true; readonly geo: DiscoveryGeoFilter | undefined } | { readonly ok: false; readonly error: DiscoveryQueryError; readonly detail: string };

// Section 30: lat/lng are all-or-nothing, and radius requires both. Never guessed at.
function parseGeo(raw: Record<string, unknown>): GeoParseResult {
  const hasLat = raw["lat"] !== undefined;
  const hasLng = raw["lng"] !== undefined;
  const hasRadius = raw["radius"] !== undefined;

  if (!hasLat && !hasLng && !hasRadius) {
    return { ok: true, geo: undefined };
  }
  if (hasLat !== hasLng) {
    return { ok: false, error: "invalid-location", detail: "lat and lng must be provided together" };
  }
  if (!hasLat) {
    return { ok: false, error: "invalid-location", detail: "radius requires lat and lng" };
  }

  const lat = Number(raw["lat"]);
  const lng = Number(raw["lng"]);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { ok: false, error: "invalid-location", detail: "lat must be a number between -90 and 90" };
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return { ok: false, error: "invalid-location", detail: "lng must be a number between -180 and 180" };
  }

  const radius = hasRadius ? Number(raw["radius"]) : RADIUS_DEFAULT_METERS;
  if (!Number.isInteger(radius) || radius < RADIUS_MIN_METERS || radius > RADIUS_MAX_METERS) {
    return {
      ok: false,
      error: "invalid-radius",
      detail: `radius must be an integer between ${RADIUS_MIN_METERS} and ${RADIUS_MAX_METERS} meters`,
    };
  }

  return { ok: true, geo: { lat, lng, radiusMeters: radius } };
}
