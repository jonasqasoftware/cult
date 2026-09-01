import { assertProductionConfig, loadAppEnv, loadDotEnvIfPresent } from "@cult/config";
import { createDatabaseConnection } from "@cult/database";
import { buildServer } from "./server.js";

loadDotEnvIfPresent();

// M10 section 10 — fail closed at startup rather than serving traffic against config that
// silently fell back to a development default (e.g. a forgotten localhost URL).
assertProductionConfig();

const env = loadAppEnv();
const host = process.env["API_HOST"] ?? "0.0.0.0";

const connection = createDatabaseConnection({ connectionString: env.databaseUrl });
const app = buildServer({ db: connection.db });

app
  .listen({ port: env.apiPort, host })
  .then(() => {
    app.log.info(`CULT API listening on http://${host}:${env.apiPort}`);
  })
  .catch((error: unknown) => {
    app.log.error(error);
    process.exit(1);
  });
