// Server-only. Never NEXT_PUBLIC_* — the Fastify API stays private, reachable only from
// Server Components and the small BFF route handler (see app/api/discovery/route.ts), never
// directly from the browser (M8 section 7).
export function getCultApiBaseUrl(): string {
  return process.env["CULT_API_BASE_URL"] ?? "http://localhost:3001";
}
