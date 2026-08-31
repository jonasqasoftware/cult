import { buildServer } from "./server.js";

const port = Number(process.env["API_PORT"] ?? 3001);
const host = process.env["API_HOST"] ?? "0.0.0.0";

const app = buildServer();

app
  .listen({ port, host })
  .then(() => {
    app.log.info(`CULT API listening on http://${host}:${port}`);
  })
  .catch((error: unknown) => {
    app.log.error(error);
    process.exit(1);
  });
