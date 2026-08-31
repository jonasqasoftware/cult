import type { AppEnv } from "@cult/config";

export type LiveIngestionGateResult =
  | { readonly allowed: true; readonly apiKey: string }
  | { readonly allowed: false; readonly reason: string };

// Blocks the live-persisting Ticketmaster ingestion unless both an API key is present AND an
// operator has explicitly acknowledged that retention for real Event Content is legally/
// commercially cleared (docs/sources/ticketmaster.md, ADR-0013). Extracted as a pure function
// so this decision is unit-testable without spawning the CLI or touching the network/DB.
export function checkLiveIngestionAllowed(env: AppEnv): LiveIngestionGateResult {
  if (!env.ticketmasterApiKey) {
    return {
      allowed: false,
      reason:
        "TICKETMASTER_API_KEY is not set. Add it to your local .env to run a live ingestion " +
        "— this command never falls back to the fixture. See docs/sources/ticketmaster.md.",
    };
  }

  if (!env.ticketmasterLivePersistAck) {
    return {
      allowed: false,
      reason:
        "Refusing to persist live Ticketmaster data: retention is not yet legally/" +
        "commercially cleared (see docs/sources/ticketmaster.md, ADR-0013). Set " +
        "TICKETMASTER_LIVE_PERSIST_ACK=true to override, or run " +
        "`pnpm ingest:ticketmaster:live-smoke` for a non-persisting connectivity check.",
    };
  }

  return { allowed: true, apiKey: env.ticketmasterApiKey };
}
