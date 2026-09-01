import { describe, expect, it } from "vitest";
import { assertProductionConfig, validateProductionConfig } from "./production-config.js";

const VALID_PRODUCTION_ENV = {
  CULT_ENV: "production",
  DATABASE_URL: "postgresql://user:pass@db.internal:5432/cult",
  CULT_API_BASE_URL: "https://api.cult.example.com",
  NEXT_PUBLIC_SITE_URL: "https://cult.example.com",
};

describe("validateProductionConfig", () => {
  it("is a no-op (always valid) outside production", () => {
    expect(validateProductionConfig({ CULT_ENV: "development" })).toEqual({ valid: true, errors: [] });
    expect(validateProductionConfig({ CULT_ENV: "staging" })).toEqual({ valid: true, errors: [] });
    expect(validateProductionConfig({})).toEqual({ valid: true, errors: [] });
  });

  it("is valid in production when all required vars are set to non-localhost URLs", () => {
    expect(validateProductionConfig(VALID_PRODUCTION_ENV)).toEqual({ valid: true, errors: [] });
  });

  it("fails when DATABASE_URL is missing in production", () => {
    const { DATABASE_URL: _drop, ...rest } = VALID_PRODUCTION_ENV;
    const result = validateProductionConfig(rest);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("DATABASE_URL"))).toBe(true);
  });

  it("fails when CULT_API_BASE_URL is missing in production", () => {
    const { CULT_API_BASE_URL: _drop, ...rest } = VALID_PRODUCTION_ENV;
    const result = validateProductionConfig(rest);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("CULT_API_BASE_URL"))).toBe(true);
  });

  it("fails when NEXT_PUBLIC_SITE_URL is missing in production", () => {
    const { NEXT_PUBLIC_SITE_URL: _drop, ...rest } = VALID_PRODUCTION_ENV;
    const result = validateProductionConfig(rest);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("NEXT_PUBLIC_SITE_URL"))).toBe(true);
  });

  it("does not silently accept localhost for a required URL in production", () => {
    const result = validateProductionConfig({
      ...VALID_PRODUCTION_ENV,
      CULT_API_BASE_URL: "http://localhost:3001",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("CULT_API_BASE_URL"))).toBe(true);
  });

  it("collects every violation, not just the first", () => {
    const result = validateProductionConfig({ CULT_ENV: "production" });
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe("assertProductionConfig", () => {
  it("does not throw when config is valid", () => {
    expect(() => assertProductionConfig(VALID_PRODUCTION_ENV)).not.toThrow();
  });

  it("throws with all violations listed when config is invalid", () => {
    expect(() => assertProductionConfig({ CULT_ENV: "production" })).toThrow(/DATABASE_URL/);
  });
});
