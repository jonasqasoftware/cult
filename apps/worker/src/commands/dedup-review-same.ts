import { loadAppEnv, loadDotEnvIfPresent } from "@cult/config";
import { decideCandidateBySame } from "../dedup-review.js";

async function main(): Promise<void> {
  // Skip any literal "--" separators — pnpm's own nested `--filter ... run ... --` forwarding
  // (root package.json -> apps/worker's package.json) can leave one in argv depending on how
  // many indirection layers the invocation went through.
  const candidateId = process.argv.slice(2).find((arg) => arg !== "--");
  if (!candidateId) {
    console.error("usage: pnpm dedup:review:same -- <candidate-id>");
    process.exit(1);
  }

  loadDotEnvIfPresent();
  const env = loadAppEnv();
  const result = await decideCandidateBySame(env.databaseUrl, candidateId, new Date());

  if (!result) {
    console.error(`No candidate found with id "${candidateId}"`);
    process.exit(1);
  }

  console.log(`candidate ${result.id} marked confirmed_same (decision_source=human)`);
}

main().catch((error: unknown) => {
  console.error("[worker] dedup review (same) failed:", error);
  process.exit(1);
});
