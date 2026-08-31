import { loadAppEnv } from "@cult/config";
import { createDatabaseConnection } from "@cult/database";
import { buildServer } from "./server.js";

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
