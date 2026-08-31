import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTicketmasterFixtureAdapter } from "@cult/connectors";
import { loadAppEnv } from "@cult/config";
import { runTicketmasterIngestion } from "../ingest-ticketmaster.js";

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../test-data/golden-events/ticketmaster/event-search-response.json",
);

async function main(): Promise<void> {
  const env = loadAppEnv();
  const adapter = createTicketmasterFixtureAdapter({ fixturePath });
  const summary = await runTicketmasterIngestion(adapter, env.databaseUrl);
  console.log(JSON.stringify(summary));
}

main().catch((error: unknown) => {
  console.error("[worker] ticketmaster fixture ingestion failed:", error);
  process.exit(1);
});
