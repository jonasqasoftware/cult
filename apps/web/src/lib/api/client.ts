import { getCultApiBaseUrl } from "./env";
import type {
  CategoryListResponse,
  CultEvent,
  DiscoveryFilters,
  EventListResponse,
  ProblemDetails,
} from "./types";

// Thrown for both a Problem Details response (4xx/5xx with a parsed body) and a transport
// failure (network error, non-JSON response) — always with a message safe to show a user.
// Never carries the raw fetch/driver error; callers that want it for logging read `.cause`.
export class CultApiError extends Error {
  readonly status: number | undefined;
  readonly problem: ProblemDetails | undefined;

  constructor(
    message: string,
    options: { status?: number | undefined; problem?: ProblemDetails | undefined; cause?: unknown } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "CultApiError";
    this.status = options.status;
    this.problem = options.problem;
  }
}

function buildSearchParams(filters: DiscoveryFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.period) params.set("period", filters.period);
  if (filters.start) params.set("start", filters.start);
  if (filters.end) params.set("end", filters.end);
  if (filters.category) params.set("category", filters.category);
  if (filters.free !== undefined) params.set("free", String(filters.free));
  if (filters.lat !== undefined) params.set("lat", String(filters.lat));
  if (filters.lng !== undefined) params.set("lng", String(filters.lng));
  if (filters.radius !== undefined) params.set("radius", String(filters.radius));
  if (filters.status) params.set("status", filters.status);
  if (filters.cursor) params.set("cursor", filters.cursor);
  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  return params;
}

async function requestJson<T>(path: string, searchParams?: URLSearchParams): Promise<T> {
  const base = getCultApiBaseUrl();
  const url = new URL(path, base);
  if (searchParams) {
    for (const [key, value] of searchParams) url.searchParams.set(key, value);
  }

  let response: Response;
  try {
    // Discovery/event data is live and product-critical to keep fresh — never let Next's
    // fetch cache silently serve a stale page (see also "no offline event cache", section 51).
    response = await fetch(url, { cache: "no-store" });
  } catch (error) {
    throw new CultApiError("Could not reach the CULT API.", { cause: error });
  }

  if (!response.ok) {
    let problem: ProblemDetails | undefined;
    try {
      problem = (await response.json()) as ProblemDetails;
    } catch {
      // Body wasn't valid Problem Details JSON — fall through with no parsed problem.
    }
    throw new CultApiError(problem?.detail ?? "The CULT API returned an error.", {
      status: response.status,
      problem,
    });
  }

  return (await response.json()) as T;
}

export async function discoverEvents(filters: DiscoveryFilters): Promise<EventListResponse> {
  return requestJson<EventListResponse>("/v1/events", buildSearchParams(filters));
}

export async function getEvent(slug: string): Promise<CultEvent | null> {
  try {
    return await requestJson<CultEvent>(`/v1/events/${encodeURIComponent(slug)}`);
  } catch (error) {
    if (error instanceof CultApiError && error.status === 404) return null;
    throw error;
  }
}

export async function listCategories(): Promise<CategoryListResponse> {
  return requestJson<CategoryListResponse>("/v1/categories");
}
