import type { TicketmasterEventSearchResponse } from "./ticketmaster-types.js";

// Discovery API v2. `latlong` is deprecated upstream and intentionally not supported.
const DEFAULT_BASE_URL = "https://app.ticketmaster.com/discovery/v2/";
const DEFAULT_TIMEOUT_MS = 8000;
// Ticketmaster documents a default 5 requests/second limit — a simple, explicit minimum
// interval between requests is enough for M2 (no queue, no Redis, no rate-limit framework).
const DEFAULT_MIN_REQUEST_INTERVAL_MS = 200;

export interface TicketmasterClientConfig {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  readonly minRequestIntervalMs?: number;
}

export interface SearchEventsParams {
  readonly countryCode: string;
  readonly city: string;
  readonly page?: number;
  readonly size?: number;
  readonly startDateTime?: string;
  readonly endDateTime?: string;
}

export type TicketmasterClientErrorKind =
  | "unauthorized"
  | "rate_limited"
  | "server_error"
  | "timeout"
  | "network_error"
  | "unexpected_status";

export class TicketmasterClientError extends Error {
  readonly kind: TicketmasterClientErrorKind;
  readonly status?: number;

  constructor(message: string, kind: TicketmasterClientErrorKind, status?: number) {
    super(message);
    this.name = "TicketmasterClientError";
    this.kind = kind;
    if (status !== undefined) this.status = status;
  }
}

export interface TicketmasterClient {
  searchEvents(params: SearchEventsParams): Promise<TicketmasterEventSearchResponse>;
}

// Never logs or includes the API key in any thrown error message. Base URL is
// configurable so tests can stub `fetch` without a real network call.
export function createTicketmasterClient(config: TicketmasterClientConfig): TicketmasterClient {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const minIntervalMs = config.minRequestIntervalMs ?? DEFAULT_MIN_REQUEST_INTERVAL_MS;
  let lastRequestAt = 0;

  async function throttle(): Promise<void> {
    const elapsed = Date.now() - lastRequestAt;
    if (elapsed < minIntervalMs) {
      await new Promise((resolve) => setTimeout(resolve, minIntervalMs - elapsed));
    }
    lastRequestAt = Date.now();
  }

  return {
    async searchEvents(params: SearchEventsParams): Promise<TicketmasterEventSearchResponse> {
      await throttle();

      const url = new URL("events.json", baseUrl);
      url.searchParams.set("apikey", config.apiKey);
      url.searchParams.set("countryCode", params.countryCode);
      url.searchParams.set("city", params.city);
      if (params.page !== undefined) url.searchParams.set("page", String(params.page));
      if (params.size !== undefined) url.searchParams.set("size", String(params.size));
      if (params.startDateTime) url.searchParams.set("startDateTime", params.startDateTime);
      if (params.endDateTime) url.searchParams.set("endDateTime", params.endDateTime);

      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;
      try {
        response = await fetch(url, { signal: controller.signal });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new TicketmasterClientError("Ticketmaster request timed out", "timeout");
        }
        throw new TicketmasterClientError(
          `Ticketmaster request failed: ${error instanceof Error ? error.message : String(error)}`,
          "network_error",
        );
      } finally {
        clearTimeout(timeoutHandle);
      }

      if (response.status === 401) {
        throw new TicketmasterClientError("Ticketmaster rejected the API key", "unauthorized", 401);
      }
      if (response.status === 429) {
        throw new TicketmasterClientError("Ticketmaster rate limit exceeded", "rate_limited", 429);
      }
      if (response.status >= 500) {
        throw new TicketmasterClientError(
          `Ticketmaster server error (${response.status})`,
          "server_error",
          response.status,
        );
      }
      if (!response.ok) {
        throw new TicketmasterClientError(
          `Unexpected Ticketmaster response status (${response.status})`,
          "unexpected_status",
          response.status,
        );
      }

      return (await response.json()) as TicketmasterEventSearchResponse;
    },
  };
}
