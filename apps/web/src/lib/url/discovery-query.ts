import type { DiscoveryFilters, Period } from "../api/types";

const PERIODS: readonly Period[] = ["today", "tomorrow", "weekend", "this_week", "this_month"];

// Clears one or more filter fields by omitting the keys entirely (never by assigning
// `undefined` to them) — DiscoveryFilters' optional fields don't include `undefined` in their
// own type, by design, so this is the one place that needs to know how to drop a key safely.
export function omitFilters(filters: DiscoveryFilters, keys: readonly (keyof DiscoveryFilters)[]): DiscoveryFilters {
  const result: Record<string, unknown> = { ...filters };
  for (const key of keys) delete result[key];
  return result as DiscoveryFilters;
}

// Ordered so a built href is stable/deterministic across calls with the same filters —
// important for it to be a reliable, shareable, cacheable link (M8 section 12).
const FIELD_ORDER: readonly (keyof DiscoveryFilters)[] = [
  "q",
  "period",
  "start",
  "end",
  "category",
  "free",
  "lat",
  "lng",
  "radius",
  "status",
  "cursor",
  "limit",
];

// Coarse enough for an urban-scale point+radius query, nowhere near the precision the browser
// actually reported — never expose more location precision in a shareable URL than the
// product needs (M8 section 30).
const COORDINATE_PRECISION = 4;

export interface BuildDiscoveryHrefOptions {
  readonly includeCursor?: boolean;
}

export function buildDiscoveryHref(filters: DiscoveryFilters, options: BuildDiscoveryHrefOptions = {}): string {
  const includeCursor = options.includeCursor ?? true;
  const params = new URLSearchParams();

  for (const field of FIELD_ORDER) {
    if (field === "cursor" && !includeCursor) continue;
    const value = filters[field];
    if (value === undefined) continue;
    if (field === "lat" || field === "lng") {
      params.set(field, (value as number).toFixed(COORDINATE_PRECISION));
    } else {
      params.set(field, String(value));
    }
  }

  const query = params.toString();
  return query.length > 0 ? `/?${query}` : "/";
}

type RawSearchParams = Record<string, string | readonly string[] | undefined>;

function firstValue(raw: RawSearchParams, key: string): string | undefined {
  const value = raw[key];
  if (Array.isArray(value)) return value[0];
  return value as string | undefined;
}

// Reflects the URL's query string back into typed filters for SSR rendering — deliberately
// lenient (an invalid/garbled param is just dropped, not a validation error at this layer;
// the API itself is the source of truth and returns Problem Details for anything it rejects).
export function searchParamsToFilters(raw: RawSearchParams): DiscoveryFilters {
  const filters: { -readonly [K in keyof DiscoveryFilters]?: DiscoveryFilters[K] } = {};

  const q = firstValue(raw, "q");
  if (q) filters.q = q;

  const period = firstValue(raw, "period");
  if (period && (PERIODS as readonly string[]).includes(period)) filters.period = period as Period;

  const start = firstValue(raw, "start");
  if (start) filters.start = start;

  const end = firstValue(raw, "end");
  if (end) filters.end = end;

  const category = firstValue(raw, "category");
  if (category) filters.category = category;

  const free = firstValue(raw, "free");
  if (free === "true") filters.free = true;
  else if (free === "false") filters.free = false;

  const cursor = firstValue(raw, "cursor");
  if (cursor) filters.cursor = cursor;

  const latRaw = firstValue(raw, "lat");
  const lngRaw = firstValue(raw, "lng");
  if (latRaw !== undefined && lngRaw !== undefined) {
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      filters.lat = lat;
      filters.lng = lng;
      const radiusRaw = firstValue(raw, "radius");
      const radius = radiusRaw !== undefined ? Number(radiusRaw) : undefined;
      if (radius !== undefined && Number.isFinite(radius)) filters.radius = radius;
    }
  }

  return filters;
}
