# syntax=docker/dockerfile:1
# M10 section 13 — production image for @cult/worker. Not a long-running daemon: the
# container has no fixed entrypoint command — it's invoked per-command by the deployment
# environment's own scheduler/cron (M10 section 39), e.g.:
#   docker run --rm cult-worker node apps/worker/dist/commands/dedup-scan.js
#   docker run --rm cult-worker node apps/worker/dist/commands/ops-summary.js
# See docker/api/Dockerfile for the stage-by-stage rationale — identical structure, only the
# copied app and default command differ. Build from the repo root:
#   docker build -f docker/worker/Dockerfile -t cult-worker .

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm exec tsc -b tsconfig.json

FROM base AS prod-deps
COPY . .
RUN pnpm install --prod --frozen-lockfile

FROM node:24-alpine AS runtime
RUN addgroup -S cult && adduser -S cult -G cult
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=prod-deps /repo/node_modules ./node_modules
COPY --from=prod-deps /repo/package.json ./package.json
COPY --from=prod-deps /repo/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=prod-deps /repo/packages ./packages
COPY --from=prod-deps /repo/apps/worker ./apps/worker

COPY --from=build /repo/packages/domain/dist ./packages/domain/dist
COPY --from=build /repo/packages/config/dist ./packages/config/dist
COPY --from=build /repo/packages/database/dist ./packages/database/dist
COPY --from=build /repo/packages/connectors/dist ./packages/connectors/dist
COPY --from=build /repo/packages/canonical-events/dist ./packages/canonical-events/dist
COPY --from=build /repo/packages/deduplication/dist ./packages/deduplication/dist
COPY --from=build /repo/apps/worker/dist ./apps/worker/dist

USER cult
# No CMD/ENTRYPOINT default — every invocation names the command explicitly (see header).
