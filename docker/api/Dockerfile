# syntax=docker/dockerfile:1
# M10 section 13 — production image for @cult/api (Fastify). Multi-stage: `build` compiles
# TypeScript with full (dev) dependencies; `prod-deps` installs ONLY production
# dependencies (a separate, clean `pnpm install --prod`, not a prune of the dev install);
# `runtime` combines prod-deps' node_modules/workspace-package symlinks with build's compiled
# dist output — devDependencies and TypeScript source never reach the shipped image. Build
# from the repo root:
#   docker build -f docker/api/Dockerfile -t cult-api .

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

# Prod-only node_modules, including each workspace package's own node_modules/@cult/*
# symlinks (pnpm's isolated linking puts them there, not hoisted to the repo root — see
# apps/web's Dockerfile comment for the sibling issue this caused with Next's tracer).
COPY --from=prod-deps /repo/node_modules ./node_modules
COPY --from=prod-deps /repo/package.json ./package.json
COPY --from=prod-deps /repo/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=prod-deps /repo/packages ./packages
COPY --from=prod-deps /repo/apps/api ./apps/api

# Overlay compiled output on top — prod-deps never ran tsc, so these dirs don't exist there.
COPY --from=build /repo/packages/domain/dist ./packages/domain/dist
COPY --from=build /repo/packages/config/dist ./packages/config/dist
COPY --from=build /repo/packages/database/dist ./packages/database/dist
COPY --from=build /repo/apps/api/dist ./apps/api/dist

USER cult
EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]
