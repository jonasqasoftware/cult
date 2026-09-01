import { createTicketmasterAdapter } from "@cult/connectors";
import { loadAppEnv, loadDotEnvIfPresent, TICKETMASTER_SOURCE_DEFINITION } from "@cult/config";
import { checkLiveIngestionAllowed } from "../live-ingestion-gate.js";
import { checkProductionSourceAllowed } from "../production-source-gate.js";
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

  // M10 section 4/8 — TICKETMASTER_LIVE_PERSIST_ACK above is a development control-flow
  // convenience, never production authorization. This second, independent check is the one
  // that actually fails closed in production.
  const productionGate = checkProductionSourceAllowed(env.cultEnv, TICKETMASTER_SOURCE_DEFINITION);
  if (!productionGate.allowed) {
    console.error(`[worker] ${productionGate.reason}`);
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
