import { createTicketmasterAdapter } from "@cult/connectors";
import { loadAppEnv, loadDotEnvIfPresent } from "@cult/config";
import { checkLiveIngestionAllowed } from "../live-ingestion-gate.js";
import { runTicketmasterIngestion } from "../ingest-ticketmaster.js";

async function main(): Promise<void> {
  loadDotEnvIfPresent();
  const env = loadAppEnv();

  const gate = checkLiveIngestionAllowed(env);
  if (!gate.allowed) {
    console.error(`[worker] ${gate.reason}`);
    process.exit(1);
    return;
  }

  const adapter = createTicketmasterAdapter({ apiKey: gate.apiKey });
  const summary = await runTicketmasterIngestion(adapter, env.databaseUrl);
  console.log(JSON.stringify(summary));
}

main().catch((error: unknown) => {
  console.error("[worker] ticketmaster live ingestion failed:", error);
  process.exit(1);
});
