import path from "node:path";
import { createManualFileAdapter } from "@cult/connectors";
import { loadAppEnv, loadDotEnvIfPresent, MANUAL_BETA_SOURCE_DEFINITION } from "@cult/config";
import { checkProductionSourceAllowed } from "../production-source-gate.js";
import { runManualIngestion } from "../ingest-manual.js";

async function main(): Promise<void> {
  // pnpm's nested `--filter ... run ... --` forwarding can leave a literal "--" in argv
  // (see dedup-review-same.ts for the same issue/fix).
  const rawFilePath = process.argv.slice(2).find((arg) => arg !== "--");
  if (!rawFilePath) {
    console.error("usage: pnpm ingest:manual -- <file.json>");
    process.exit(1);
    return;
  }
  // `pnpm --filter @cult/worker run ...` runs this script with cwd set to apps/worker, not
  // wherever the user actually typed the command — resolve a relative path against pnpm's
  // own INIT_CWD (the original invocation directory) so `pnpm ingest:manual -- some/file.json`
  // works from the repo root as documented, not just from apps/worker.
  const filePath = path.resolve(process.env["INIT_CWD"] ?? process.cwd(), rawFilePath);

  loadDotEnvIfPresent();
  const env = loadAppEnv();

  const productionGate = checkProductionSourceAllowed(env.cultEnv, MANUAL_BETA_SOURCE_DEFINITION);
  if (!productionGate.allowed) {
    console.error(`[worker] ${productionGate.reason}`);
    process.exit(1);
    return;
  }

  const adapter = createManualFileAdapter({ filePath });
  const summary = await runManualIngestion(adapter, env.databaseUrl);
  console.log(JSON.stringify(summary));
}

main().catch((error: unknown) => {
  console.error("[worker] manual ingestion failed:", error);
  process.exit(1);
});
