import { loadAppEnv, loadDotEnvIfPresent } from "@cult/config";
import { decideCandidateByDifferent } from "../dedup-review.js";

async function main(): Promise<void> {
  // See dedup-review-same.ts for why a stray "--" is filtered rather than assumed absent.
  const candidateId = process.argv.slice(2).find((arg) => arg !== "--");
  if (!candidateId) {
    console.error("usage: pnpm dedup:review:different -- <candidate-id>");
    process.exit(1);
  }

  loadDotEnvIfPresent();
  const env = loadAppEnv();
  const result = await decideCandidateByDifferent(env.databaseUrl, candidateId, new Date());

  if (!result) {
    console.error(`No candidate found with id "${candidateId}"`);
    process.exit(1);
  }

  console.log(`candidate ${result.id} marked confirmed_different (decision_source=human)`);
}

main().catch((error: unknown) => {
  console.error("[worker] dedup review (different) failed:", error);
  process.exit(1);
});
