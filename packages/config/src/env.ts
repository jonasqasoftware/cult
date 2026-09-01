import path from "node:path";
import { fileURLToPath } from "node:url";

// packages/config/src/env.ts -> up 3 levels (src -> config -> packages) -> repo root.
// Computed from this file's own location so it's correct whether running from src (tsx)
// or from dist (built), and regardless of the caller's cwd (e.g. `pnpm --filter` scripts
// run with cwd set to that package's directory, not the repo root).
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

// Loads `.env` via Node's own built-in process.loadEnvFile (stable since Node ~21) — no
// `dotenv` dependency. A missing file is fine (e.g. CI sets real env vars directly); any
// other failure (e.g. a malformed file) is surfaced loudly instead of silently ignored.
export function loadDotEnvIfPresent(fileName = ".env"): void {
  const envPath = path.join(REPO_ROOT, fileName);
  try {
    process.loadEnvFile(envPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

// M10 section 9 — formalizes the release environment distinctly from NODE_ENV (which many
// libraries also read/set, for build-mode reasons unrelated to "which deployed environment
// is this"). Not inferred from NODE_ENV: the two answer different questions, and conflating
// them is exactly what section 9 warns against.
export type CultEnv = "development" | "test" | "staging" | "production";

const VALID_CULT_ENVS: readonly CultEnv[] = ["development", "test", "staging", "production"];

function parseCultEnv(raw: string | undefined): CultEnv {
  const value = raw ?? "development";
  if (!(VALID_CULT_ENVS as readonly string[]).includes(value)) {
    throw new Error(
      `CULT_ENV must be one of ${VALID_CULT_ENVS.join("|")}, got "${value}". Fix the environment ` +
        "rather than letting an unrecognized value pass through silently.",
    );
  }
  return value as CultEnv;
}

export interface AppEnv {
  readonly nodeEnv: string;
  readonly cultEnv: CultEnv;
  readonly databaseUrl: string;
  readonly apiPort: number;
  readonly ticketmasterApiKey?: string;
  // Must be exactly "true" to allow a live (non-fixture) Ticketmaster ingestion to persist
  // data — see docs/sources/ticketmaster.md and ADR-0013. Retention for real Event Content
  // is not yet legally/commercially cleared, so persistence stays blocked by default. This
  // is a DEVELOPMENT control-flow acknowledgement only — it is never treated as production
  // legal/commercial authorization (see production-config.ts / ADR-0015).
  readonly ticketmasterLivePersistAck: boolean;
}

// Pure env loading — no framework, no validation library. Throws fast on a genuinely
// required, missing variable rather than silently defaulting it.
export function loadAppEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  const databaseUrl = env["DATABASE_URL"];
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const ticketmasterApiKey = env["TICKETMASTER_API_KEY"];

  return {
    nodeEnv: env["NODE_ENV"] ?? "development",
    cultEnv: parseCultEnv(env["CULT_ENV"]),
    databaseUrl,
    apiPort: Number(env["API_PORT"] ?? 3001),
    ...(ticketmasterApiKey ? { ticketmasterApiKey } : {}),
    ticketmasterLivePersistAck: env["TICKETMASTER_LIVE_PERSIST_ACK"] === "true",
  };
}
