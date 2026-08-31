// Standalone migration runner — invoked via `pnpm --filter @cult/database run db:migrate`.
// Not part of the package's exported library API (not re-exported from index.ts).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const connectionString = process.env["DATABASE_URL"];
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run migrations");
}

const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "drizzle");

async function main(): Promise<void> {
  const pool = new Pool({ connectionString });
  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder });
    console.log("[database] migrations applied");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("[database] migration failed:", error);
  process.exit(1);
});
