import { loadAppEnv, loadDotEnvIfPresent } from "@cult/config";
import { listPendingReviewCandidates } from "../dedup-review.js";

function describeEvent(event: { title: string; occurrences: readonly { kind: string }[]; venue?: { name: string } | undefined; sources: readonly { sourceId: string }[] } | undefined): string {
  if (!event) return "  (event no longer exists)";
  const occurrence = event.occurrences[0];
  const dateLabel = occurrence ? occurrence.kind : "no occurrence";
  const venueLabel = event.venue ? event.venue.name : "no venue";
  const sourceLabel = event.sources.map((s) => s.sourceId).join(", ");
  return `  ${event.title} — ${dateLabel} — ${venueLabel} — source: ${sourceLabel}`;
}

async function main(): Promise<void> {
  loadDotEnvIfPresent();
  const env = loadAppEnv();
  const entries = await listPendingReviewCandidates(env.databaseUrl);

  if (entries.length === 0) {
    console.log("No candidates pending review.");
    return;
  }

  for (const entry of entries) {
    console.log(`candidate: ${entry.candidate.id}`);
    console.log(`  A: ${entry.candidate.leftEventId}`);
    console.log(describeEvent(entry.left));
    console.log(`  B: ${entry.candidate.rightEventId}`);
    console.log(describeEvent(entry.right));
    console.log(`  score: ${entry.candidate.score.toFixed(3)}`);
    console.log(`  signals: ${JSON.stringify(entry.candidate.signals)}`);
    console.log(`  conflicts: ${entry.candidate.conflicts.length > 0 ? entry.candidate.conflicts.join(", ") : "none"}`);
    console.log(`  blockers: ${entry.candidate.blockers.length > 0 ? entry.candidate.blockers.join(", ") : "none"}`);
    console.log("");
  }
}

main().catch((error: unknown) => {
  console.error("[worker] dedup review list failed:", error);
  process.exit(1);
});
