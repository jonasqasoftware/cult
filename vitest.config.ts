import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["apps/**/src/**/*.test.ts", "packages/**/src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
    passWithNoTests: false,
    // packages/database's repository tests share one PostgreSQL instance and TRUNCATE
    // the same tables in beforeEach; running test files in parallel deadlocks Postgres.
    fileParallelism: false,
  },
});
