import { fileURLToPath, URL } from "node:url";

const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));

// Linting is handled once, at the workspace root (`pnpm lint`), not per-app.
// Next.js 16 removed build-time ESLint integration (`next.config` `eslint` key
// and `next lint`), so there is nothing to opt out of here anymore.
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: workspaceRoot,
};

export default nextConfig;
