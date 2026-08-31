import { sql } from "drizzle-orm";
import type { Database } from "./client.js";

// Lightweight connectivity check for readiness probes — throws if the database is unreachable.
export async function ping(db: Database): Promise<void> {
  await db.execute(sql`SELECT 1`);
}
