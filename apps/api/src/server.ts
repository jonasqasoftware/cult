import Fastify, { type FastifyInstance } from "fastify";

export function buildServer(): FastifyInstance {
  const app = Fastify({ logger: true });

  app.get("/health", async () => {
    return { status: "ok" };
  });

  // NOTE: this does not yet check real dependencies (e.g. the database).
  // Dependency checks land once packages/database is implemented (M1+).
  app.get("/ready", async () => {
    return { status: "ready" };
  });

  return app;
}
