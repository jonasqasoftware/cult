import { createTicketmasterAdapter } from "@cult/connectors";
import { loadAppEnv } from "@cult/config";
import { runTicketmasterIngestion } from "../ingest-ticketmaster.js";

async function main(): Promise<void> {
  const env = loadAppEnv();
  if (!env.ticketmasterApiKey) {
    console.error(
      "[worker] TICKETMASTER_API_KEY is not set. Add it to your local .env to run a live " +
        "ingestion — this command never falls back to the fixture. See docs/sources/ticketmaster.md.",
    );
    process.exit(1);
    return;
  }

  const adapter = createTicketmasterAdapter({ apiKey: env.ticketmasterApiKey });
  const summary = await runTicketmasterIngestion(adapter, env.databaseUrl);
  console.log(JSON.stringify(summary));
}

main().catch((error: unknown) => {
  console.error("[worker] ticketmaster live ingestion failed:", error);
  process.exit(1);
});
