// M10 section 10 — the single production config gate, shared by every long-running process
// (API, Web) rather than each reinventing its own ad-hoc env checks. A no-op outside
// CULT_ENV=production: staging/development are explicitly allowed to run against
// fixtures/localhost (M10 section 2), and this function must never block that.
export interface ProductionConfigValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const REQUIRED_PRODUCTION_VARS = ["DATABASE_URL", "CULT_API_BASE_URL", "NEXT_PUBLIC_SITE_URL"] as const;

export function validateProductionConfig(
  env: NodeJS.ProcessEnv = process.env,
): ProductionConfigValidationResult {
  if (env["CULT_ENV"] !== "production") {
    return { valid: true, errors: [] };
  }

  const errors: string[] = [];
  for (const name of REQUIRED_PRODUCTION_VARS) {
    const value = env[name];
    if (!value) {
      errors.push(`${name} is required when CULT_ENV=production and is not set.`);
      continue;
    }
    if (value.includes("localhost") || value.includes("127.0.0.1")) {
      errors.push(`${name} must not point at localhost/127.0.0.1 when CULT_ENV=production (got "${value}").`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// Fail-closed entry point for process startup (apps/api/src/index.ts,
// apps/web/instrumentation.ts): throws with every violation listed, rather than starting a
// production process against config that silently falls back to a development default.
export function assertProductionConfig(env: NodeJS.ProcessEnv = process.env): void {
  const result = validateProductionConfig(env);
  if (!result.valid) {
    throw new Error(`Production config validation failed:\n${result.errors.map((error) => `  - ${error}`).join("\n")}`);
  }
}
