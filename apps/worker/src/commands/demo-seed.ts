import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAppEnv, loadDotEnvIfPresent, UI_DEMO_SOURCE_DEFINITION } from "@cult/config";
import { checkProductionSourceAllowed } from "../production-source-gate.js";
import { runDemoSeed } from "../demo-seed.js";

const datasetPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../test-data/ui-demo/events.json",
);

async function main(): Promise<void> {
  loadDotEnvIfPresent();
  const env = loadAppEnv();

  // M10.2 section 13 — fail closed, explicitly and first: this command must never persist
  // data when CULT_ENV=production, full stop. This check refuses before the process even
  // opens a database connection, independent of the generic Production Data Gate below (which
  // would also block it, since UI_DEMO_SOURCE_DEFINITION's commercialUse is never "allowed" —
  // see packages/config/src/sources.ts). Two independent layers, same pattern as
  // ingest-ticketmaster-live.ts's ACK + gate.
  if (env.cultEnv === "production") {
    console.error(
      "[worker] pnpm demo:seed refuses to run when CULT_ENV=production — the UI demo dataset " +
        "is synthetic, development/demo-only content and must never reach production. See " +
        "docs/quality/UI_DEMO_DATASET.md.",
    );
    process.exit(1);
    return;
  }

  const productionGate = checkProductionSourceAllowed(env.cultEnv, UI_DEMO_SOURCE_DEFINITION);
  if (!productionGate.allowed) {
    console.error(`[worker] ${productionGate.reason}`);
    process.exit(1);
    return;
  }

  const webBaseUrl = process.env["DEMO_WEB_BASE_URL"] ?? `http://localhost:${process.env["WEB_PORT"] ?? "3000"}`;
  const summary = await runDemoSeed({ filePath: datasetPath, webBaseUrl, databaseUrl: env.databaseUrl });
  console.log(JSON.stringify(summary));
}

main().catch((error: unknown) => {
  console.error("[worker] UI demo seed failed:", error);
  process.exit(1);
});
