import Fastify, { type FastifyInstance } from "fastify";
import { createCanonicalEventRepository, listCanonicalEvents, ping, type Database } from "@cult/database";
import { toEventResponse } from "./events-response.js";

// Filters declared in openapi/cult-api.yaml but not implemented yet (M2 is only a vertical
// slice — see docs/product/CLAUDE_CODE_EXECUTION_PLAN.md). Requesting one returns a 400
// problem+json instead of silently ignoring it and returning an unfiltered result.
const NOT_YET_IMPLEMENTED_QUERY_PARAMS = [
  "q",
  "category",
  "start",
  "end",
  "free",
  "lat",
  "lng",
  "radius",
  "status",
];

export interface BuildServerOptions {
  readonly db: Database;
}

export function buildServer(options: BuildServerOptions): FastifyInstance {
  const { db } = options;
  const app = Fastify({ logger: true });
  const canonicalEventRepository = createCanonicalEventRepository(db);

  app.get("/health", async () => {
    return { status: "ok" };
  });

  app.get("/ready", async (request, reply) => {
    try {
      await ping(db);
      return { status: "ready" };
    } catch (error) {
      // Log the real error server-side only — never in the response. A DB connection
      // failure can carry internal details (hostnames, driver errors) an external caller
      // has no business seeing.
      request.log.error({ err: error }, "readiness check failed");
      return reply
        .code(503)
        .type("application/problem+json")
        .send({
          type: "/problems/not-ready",
          title: "Service is not ready",
          status: 503,
          detail: "A required dependency is unavailable",
        });
    }
  });

  app.get("/v1/events", async (request, reply) => {
    const query = request.query as Record<string, unknown>;

    const unsupported = NOT_YET_IMPLEMENTED_QUERY_PARAMS.filter((param) => query[param] !== undefined);
    if (unsupported.length > 0) {
      return reply
        .code(400)
        .type("application/problem+json")
        .send({
          type: "/problems/filter-not-implemented",
          title: "Filter not implemented yet",
          status: 400,
          detail: `Declared in the API contract but not implemented in this milestone: ${unsupported.join(", ")}.`,
        });
    }

    const limitRaw = query["limit"];
    const limit = limitRaw !== undefined ? Number(limitRaw) : undefined;
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100)) {
      return reply.code(400).type("application/problem+json").send({
        type: "/problems/invalid-limit",
        title: "Invalid limit",
        status: 400,
        detail: "limit must be an integer between 1 and 100",
      });
    }

    const cursor = typeof query["cursor"] === "string" ? query["cursor"] : undefined;

    try {
      const result = await listCanonicalEvents(db, {
        ...(cursor ? { cursor } : {}),
        ...(limit !== undefined ? { limit } : {}),
      });
      return {
        data: result.items.map(toEventResponse),
        pagination: { next_cursor: result.nextCursor },
      };
    } catch (error) {
      return reply.code(400).type("application/problem+json").send({
        type: "/problems/invalid-cursor",
        title: "Invalid cursor",
        status: 400,
        detail: error instanceof Error ? error.message : "Invalid cursor",
      });
    }
  });

  app.get("/v1/events/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const event = await canonicalEventRepository.findBySlug(slug);
    if (!event) {
      return reply.code(404).type("application/problem+json").send({
        type: "/problems/event-not-found",
        title: "Event not found",
        status: 404,
        detail: `No event exists with slug "${slug}"`,
      });
    }
    return toEventResponse(event);
  });

  return app;
}
