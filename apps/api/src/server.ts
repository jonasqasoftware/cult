import Fastify, { type FastifyInstance } from "fastify";
import { createCanonicalEventRepository, discoverEvents, ping, type Database } from "@cult/database";
import { toEventResponse } from "./events-response.js";
import { parseDiscoveryQuery, type DiscoveryQueryError } from "./discovery-query.js";

export interface BuildServerOptions {
  readonly db: Database;
  // M7 (section 40): production supplies the real clock; tests inject a fixed instant so
  // today/tomorrow/weekend assertions never depend on when the test suite happens to run.
  readonly now?: () => Date;
}

const PROBLEM_TITLES: Record<DiscoveryQueryError, string> = {
  "invalid-date": "Invalid date",
  "invalid-period": "Invalid period",
  "invalid-location": "Invalid location",
  "invalid-radius": "Invalid radius",
  "invalid-filter-combination": "Invalid filter combination",
  "invalid-limit": "Invalid limit",
  "invalid-query-parameter": "Invalid query parameter",
};

export function buildServer(options: BuildServerOptions): FastifyInstance {
  const { db } = options;
  const now = options.now ?? (() => new Date());
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

    const parsed = parseDiscoveryQuery(query, now());
    if (!parsed.ok) {
      return reply.code(400).type("application/problem+json").send({
        type: `/problems/${parsed.error}`,
        title: PROBLEM_TITLES[parsed.error],
        status: 400,
        detail: parsed.detail,
      });
    }

    try {
      const result = await discoverEvents(db, parsed.value);
      return {
        data: result.items.map((item) => toEventResponse(item.event, item.distanceMeters)),
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
