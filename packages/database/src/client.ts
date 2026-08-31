import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

export type Database = NodePgDatabase<typeof schema>;

export interface DatabaseConnectionConfig {
  readonly connectionString: string;
}

export interface DatabaseConnection {
  readonly db: Database;
  close(): Promise<void>;
}

export function createDatabaseConnection(config: DatabaseConnectionConfig): DatabaseConnection {
  const pool = new Pool({ connectionString: config.connectionString });
  const db = drizzle(pool, { schema });

  return {
    db,
    async close(): Promise<void> {
      await pool.end();
    },
  };
}
