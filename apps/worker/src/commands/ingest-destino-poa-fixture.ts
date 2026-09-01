import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDestinoPOAFixtureAdapter } from "@cult/connectors";
import { loadAppEnv, loadDotEnvIfPresent } from "@cult/config";
import { runDestinoPOAIngestion } from "../ingest-destino-poa.js";

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../test-data/golden-events/destino-poa/agenda-feed.json",
);

async function main(): Promise<void> {
  loadDotEnvIfPresent();
  const env = loadAppEnv();
  const adapter = createDestinoPOAFixtureAdapter({ fixturePath });
  const summary = await runDestinoPOAIngestion(adapter, env.databaseUrl);
  console.log(JSON.stringify(summary));
}

main().catch((error: unknown) => {
  console.error("[worker] destino-poa fixture ingestion failed:", error);
  process.exit(1);
});
