import { fileURLToPath, URL } from "node:url";

const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: workspaceRoot,
  // Linting is handled once, at the workspace root (`pnpm lint`), not per-app.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
