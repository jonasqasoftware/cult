// Live connectivity smoke test — bounded, read-only, and NEVER touches the database.
// No retention/legal gate applies here precisely because nothing is persisted (see
// docs/sources/ticketmaster.md). Use this to check the real Discovery API is reachable
// without deciding anything about production storage.
import { createTicketmasterAdapter } from "@cult/connectors";
import { loadAppEnv, loadDotEnvIfPresent } from "@cult/config";

const SMOKE_TEST_MAX_EVENTS = 5;

async function main(): Promise<void> {
  loadDotEnvIfPresent();
  const env = loadAppEnv();

  if (!env.ticketmasterApiKey) {
    console.error("[worker] TICKETMASTER_API_KEY is not set. See docs/sources/ticketmaster.md.");
    process.exit(1);
    return;
  }

  const adapter = createTicketmasterAdapter({
    apiKey: env.ticketmasterApiKey,
    pageSize: SMOKE_TEST_MAX_EVENTS,
  });

  const startedAt = Date.now();
  let discovered = 0;

  try {
    for await (const _rawEvent of adapter.collect({})) {
      discovered += 1;
      if (discovered >= SMOKE_TEST_MAX_EVENTS) break;
    }
    console.log(
      JSON.stringify({
        ok: true,
        discovered,
        durationMs: Date.now() - startedAt,
        persisted: false,
      }),
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startedAt,
        persisted: false,
      }),
    );
    process.exit(1);
  }
}

main();
