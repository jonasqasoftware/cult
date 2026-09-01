import { NextResponse } from "next/server";

// M10 section 14/47 — a deploy-provider health check for the Web process itself. Never
// depends on the private API or an external page (that would make the Web's own health
// depend on a network hop it doesn't control) — this only confirms the Next.js server is up
// and can respond, matching what a container/load-balancer health probe actually needs.
export function GET() {
  return NextResponse.json({ status: "ok" });
}
