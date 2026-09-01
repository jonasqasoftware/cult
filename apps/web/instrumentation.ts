// Next.js's documented server-startup hook (App Router, stable since Next 15) — runs once
// when the server process boots, before it serves traffic. M10 section 10: fail closed
// rather than serve production traffic against config that silently fell back to a
// development default (e.g. a forgotten localhost URL). Shares the exact same validation
// @cult/api runs at its own startup (packages/config/src/production-config.ts) — one rule,
// not two independently-maintained copies.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertProductionConfig } = await import("@cult/config");
  assertProductionConfig();
}
