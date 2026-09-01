import { fileURLToPath, URL } from "node:url";

const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));

// Linting is handled once, at the workspace root (`pnpm lint`), not per-app.
// Next.js 16 removed build-time ESLint integration (`next.config` `eslint` key
// and `next lint`), so there is nothing to opt out of here anymore.
// M8 section 72 — baseline security headers. No CSP: MapLibre GL loads Web Workers and
// fetches tiles from a configurable, potentially third-party origin, and a strict CSP that
// isn't specifically tested against that would risk silently breaking the map; not attempted
// here. Referrer-Policy stays "strict-origin-when-cross-origin" — it still sends the origin
// (scheme+host, no path) as Referer to the OSM tile server, which is what the OSM tile usage
// policy expects for cross-origin requests, unlike a stricter "no-referrer" policy would.
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: workspaceRoot,
  // M10 section 13 — a self-contained server bundle (.next/standalone) with only the
  // production dependencies actually traced/used, so the Dockerfile doesn't need to ship
  // node_modules or devDependencies at all. See docker/web/Dockerfile.
  output: "standalone",
  // Next's own dependency tracer (@vercel/nft) does not reliably follow the
  // node_modules/@cult/* symlinks pnpm creates for workspace:* packages that live OUTSIDE
  // node_modules (in packages/*) — verified by inspecting the generated .nft.json trace
  // files, which omitted @cult/config and @cult/domain entirely despite apps/web importing
  // both. Force-including their compiled dist output is the documented escape hatch for
  // exactly this class of monorepo gap.
  outputFileTracingIncludes: {
    "/**": ["../../packages/config/dist/**", "../../packages/domain/dist/**"],
  },
  // This repo already has a root CLAUDE.md with real project instructions — don't let
  // `next dev` regenerate an unrelated stub AGENTS.md/CLAUDE.md pair inside apps/web.
  agentRules: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
