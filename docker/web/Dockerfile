# syntax=docker/dockerfile:1
# M10 section 13 — production image for @cult/web (Next.js standalone output). Build from
# the repo root:
#   docker build -f docker/web/Dockerfile -t cult-web \
#     --build-arg CULT_API_BASE_URL=https://api.internal \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://cult.example.com .
#
# NEXT_PUBLIC_* values are baked in at build time (Next.js inlines them into the client
# bundle) — a real deployment must build a fresh image per target site URL, not reuse one
# image across environments by only changing runtime env vars for these two.

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
# apps/web imports @cult/config and @cult/domain directly (instrumentation.ts, the
# /api/analytics route) — both resolve via their package.json "main"/"exports" pointing at
# ./dist/index.js, which only exists after this workspace-wide TypeScript build runs.
RUN pnpm exec tsc -b tsconfig.json
ARG CULT_API_BASE_URL=http://localhost:3001
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV CULT_API_BASE_URL=$CULT_API_BASE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @cult/web run build

FROM node:24-alpine AS runtime
RUN addgroup -S cult && adduser -S cult -G cult
WORKDIR /repo
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# .next/standalone already contains a self-contained node_modules (only the deps Next's own
# tracer found) plus apps/web/server.js — see next.config.mjs's outputFileTracingIncludes
# comment for why packages/config and packages/domain need that extra nudge: Next's tracer
# (@vercel/nft) does not follow the node_modules/@cult/* symlinks pnpm creates for
# workspace:* packages living OUTSIDE node_modules, so their dist output was traced in as
# plain files under packages/*/dist, but the @cult/* package-name symlinks that make
# `import "@cult/domain"` resolve were NOT recreated automatically — verified by running
# this exact image and hitting /api/analytics (which imports @cult/domain) before adding the
# symlinks below; it 500'd with a module-not-found until they were added.
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
# Second, separate standalone-tracing gap (found by actually running this image and setting
# CULT_ENV=production with localhost URLs: the request succeeded instead of the process
# failing closed): instrumentation.ts's compiled instrumentation.js is a root-level Next.js
# hook, not something any single route imports, so the standalone tracer never copies it or
# its chunk dependencies at all — Next's standalone server.js silently skips loading it if
# missing, with no error. Copying it (and its whole chunks dir, since its own .nft.json's
# referenced chunk filenames are content-hashed and would be fragile to hardcode) fixes this.
COPY --from=build /repo/apps/web/.next/server/instrumentation.js ./apps/web/.next/server/instrumentation.js
COPY --from=build /repo/apps/web/.next/server/chunks ./apps/web/.next/server/chunks
# outputFileTracingIncludes (next.config.mjs) only pulled in each package's dist/ output —
# without its package.json, Node has no "main"/"exports" to resolve and falls back to
# legacy resolution (looking for a bare index.js at the package root), which fails.
COPY --from=build /repo/packages/config/package.json ./packages/config/package.json
COPY --from=build /repo/packages/domain/package.json ./packages/domain/package.json
RUN mkdir -p node_modules/@cult \
  && ln -s ../../packages/config node_modules/@cult/config \
  && ln -s ../../packages/domain node_modules/@cult/domain
COPY docker/web/preflight.mjs ./preflight.mjs

USER cult
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# preflight.mjs is the real fail-closed gate — see its own header comment for why
# instrumentation.ts alone isn't enough inside Next's standalone server.
CMD ["sh", "-c", "node preflight.mjs && node apps/web/server.js"]
