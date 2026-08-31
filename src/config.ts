/**
 * @file Application Configuration Loader
 * @description Validates and parses environment variables at application startup using Zod schema validation.
 * @module config
 */

import { z } from 'zod';

/**
 * Zod schema defining required and optional environment variables.
 * Fails fast on startup if mandatory variables (such as `DATABASE_URL` or `REDIS_URL`) are missing.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  SHORT_URL_BASE: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  RATE_LIMIT_CAPACITY: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_REFILL_PER_SEC: z.coerce.number().positive().default(1),
});

/** Strongly typed application configuration object inferred from `EnvSchema`. */
export type Config = z.infer<typeof EnvSchema> & { SHORT_URL_BASE: string };

/**
 * Parses and validates `process.env` against `EnvSchema`.
 * Normalizes `SHORT_URL_BASE` by stripping any trailing slash.
 *
 * @returns Validated `Config` instance.
 * @throws {Error} If environment validation fails.
 */
function load(): Config {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }
  const cfg = parsed.data;
  cfg.SHORT_URL_BASE = cfg.SHORT_URL_BASE.replace(/\/+$/, '');
  return cfg;
}

/** Frozen, validated global application configuration instance. */
export const config = load();
