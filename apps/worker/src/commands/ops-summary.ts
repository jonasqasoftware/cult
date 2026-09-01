import { computeOpsSummary, createDatabaseConnection } from "@cult/database";
import { loadAppEnv, loadDotEnvIfPresent } from "@cult/config";

// M9 sections 30-33: CLI-only, honest metrics — no invented uptime, no admin web, no login.
// This is the foundation a future operational UI can sit on top of, not that UI itself
// (section 34).
async function main(): Promise<void> {
  loadDotEnvIfPresent();
  const env = loadAppEnv();
  const connection = createDatabaseConnection({ connectionString: env.databaseUrl });

  try {
    const summary = await computeOpsSummary(connection.db);

    console.log(`canonical events: ${summary.canonicalEvents}`);
    console.log(`raw pending: ${summary.rawPending}`);
    console.log(`raw failed: ${summary.rawFailed}`);
    console.log(`dedup pending review: ${summary.dedupPendingReview}`);
    console.log(`dedup auto-approved: ${summary.dedupAutoApproved}`);
    console.log(`confirmed same: ${summary.dedupConfirmedSame}`);
    console.log(`confirmed different: ${summary.dedupConfirmedDifferent}`);
    console.log("");
    console.log("sources:");
    for (const source of summary.sources) {
      console.log(`  ${source.name} (${source.id})`);
      console.log(`    enabled: ${source.enabled}`);
      console.log(`    last raw fetched_at: ${source.lastRawFetchedAt?.toISOString() ?? "never"}`);
      console.log(`    raw success: ${source.rawSuccessCount}`);
      console.log(`    raw failed: ${source.rawFailedCount}`);
      console.log(`    canonical references: ${source.canonicalReferenceCount}`);
    }
  } finally {
    await connection.close();
  }
}

main().catch((error: unknown) => {
  console.error("[worker] ops summary failed:", error);
  process.exit(1);
});
