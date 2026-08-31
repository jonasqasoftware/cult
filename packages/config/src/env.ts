export interface AppEnv {
  readonly nodeEnv: string;
  readonly databaseUrl: string;
  readonly apiPort: number;
  readonly ticketmasterApiKey?: string;
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
    databaseUrl,
    apiPort: Number(env["API_PORT"] ?? 3001),
    ...(ticketmasterApiKey ? { ticketmasterApiKey } : {}),
  };
}
