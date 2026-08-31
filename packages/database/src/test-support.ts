import { sql } from "drizzle-orm";
import { createDatabaseConnection, type DatabaseConnection } from "./client.js";
import { eventOccurrences, events, eventSources, rawEvents, sources, venues } from "./schema.js";

// Test-only helpers. Not part of the package's public API (not re-exported from index.ts).
// Repository tests run against a real PostgreSQL instance — see docker-compose.yml / CI.

export function getTestDatabaseUrl(): string {
  return process.env["DATABASE_URL"] ?? "postgresql://cult:cult@localhost:5432/cult";
}

export function connectTestDatabase(): DatabaseConnection {
  return createDatabaseConnection({ connectionString: getTestDatabaseUrl() });
}

export async function truncateAllTables(connection: DatabaseConnection): Promise<void> {
  await connection.db.execute(
    sql`TRUNCATE TABLE ${eventOccurrences}, ${eventSources}, ${events}, ${rawEvents}, ${venues}, ${sources} RESTART IDENTITY CASCADE`,
  );
}
