import { loadAppEnv, loadDotEnvIfPresent } from "@cult/config";
import { runDedupScan } from "../dedup-scan.js";

async function main(): Promise<void> {
  loadDotEnvIfPresent();
  const env = loadAppEnv();
  const summary = await runDedupScan(env.databaseUrl, new Date());

  console.log(`evaluated: ${summary.evaluated}`);
  console.log(`auto_merge: ${summary.autoMerge}`);
  console.log(`review: ${summary.review}`);
  console.log(`separate: ${summary.separate}`);
  console.log(`created: ${summary.created}`);
  console.log(`updated: ${summary.updated}`);
}

main().catch((error: unknown) => {
  console.error("[worker] dedup scan failed:", error);
  process.exit(1);
});
