import { like } from "drizzle-orm";
import { loadAppEnv, loadDotEnvIfPresent } from "@cult/config";
import { createDatabaseConnection, events } from "@cult/database";

async function main(): Promise<void> {
  loadDotEnvIfPresent();
  const env = loadAppEnv();

  // Same explicit fail-closed guard as demo-seed.ts (M10.2 section 13) — this command deletes
  // data, so it must never run against a production database regardless of what it's scoped
  // to delete.
  if (env.cultEnv === "production") {
    console.error("[worker] pnpm demo:reset refuses to run when CULT_ENV=production.");
    process.exit(1);
    return;
  }

  const connection = createDatabaseConnection({ connectionString: env.databaseUrl });
  try {
    // Every UI demo canonical event id is deterministically prefixed "ui-demo-"
    // (normalizeManualEvent builds id as `${sourceId}-${externalId}`, and this source's id is
    // always "ui-demo" — see demo-seed.ts) — this can only ever match those rows, never golden
    // fixtures, manual-beta, or any other source's events. The FK cascade from
    // event_occurrences/event_sources/dedup_candidates to events (onDelete: "cascade")
    // removes everything else tied to them. raw_events for source_id="ui-demo" are
    // deliberately left alone: the Raw Event Store is a permanent audit trail by design
    // (ADR-0006), and there is no reason to special-case demo data out of that.
    const deleted = await connection.db.delete(events).where(like(events.id, "ui-demo-%")).returning({ id: events.id });
    console.log(`[worker] removed ${deleted.length} UI demo event(s)`);
  } finally {
    await connection.close();
  }
}

main().catch((error: unknown) => {
  console.error("[worker] UI demo reset failed:", error);
  process.exit(1);
});
