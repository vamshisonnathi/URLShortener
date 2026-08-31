/**
 * @file Request Validation Schemas
 * @description Zod validation schemas for URL shortening payloads, custom alias constraints, and path parameters.
 * @module lib/validation
 */

import { z } from 'zod';

/**
 * Validates that a string is a well-formed HTTP or HTTPS URL.
 *
 * Rejects non-HTTP schemes (e.g. ftp://, javascript:, file://) to prevent XSS and SSRF risks.
 *
 * @param value - The candidate URL string to validate.
 * @returns `true` if valid `http:` or `https:`, otherwise `false`.
 */
function isHttpUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

/** Regular expression defining valid custom alias characters and length (3-32 chars of [A-Za-z0-9_-]). */
const ALIAS_RE = /^[A-Za-z0-9_-]{3,32}$/;

/**
 * Set of top-level reserved path segments that cannot be claimed as custom aliases.
 * Prevents alias collisions with system routes (`/health`, `/api`).
 */
export const RESERVED_ALIASES = new Set(['health', 'api']);

/**
 * Checks whether a candidate alias matches a reserved system route.
 *
 * @param alias - The custom alias string.
 * @returns `true` if reserved, otherwise `false`.
 */
function isReservedAlias(alias: string): boolean {
  return RESERVED_ALIASES.has(alias.toLowerCase());
}

/**
 * Zod schema for validating `POST /api/shorten` request bodies.
 *
 * Enforces:
 * - `url`: Required valid HTTP/HTTPS URL.
 * - `customAlias`: Optional 3-32 character alias, not matching reserved route names.
 * - `expiresAt`: Optional ISO-8601 timestamp in the future.
 * - `.strict()`: Rejects unexpected payload properties.
 */
export const ShortenBodySchema = z
  .object({
    url: z
      .string({ required_error: 'url is required' })
      .trim()
      .min(1, 'url is required')
      .refine(isHttpUrl, 'url must be a valid http(s) URL'),
    customAlias: z
      .string()
      .trim()
      .regex(ALIAS_RE, 'customAlias must be 3-32 chars of [A-Za-z0-9_-]')
      .refine((a) => !isReservedAlias(a), 'customAlias is reserved and cannot be used')
      .optional(),
    expiresAt: z
      .string()
      .datetime({ offset: true, message: 'expiresAt must be an ISO-8601 datetime' })
      .optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.expiresAt) {
      const when = new Date(data.expiresAt);
      if (when.getTime() <= Date.now()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['expiresAt'],
          message: 'expiresAt must be in the future',
        });
      }
    }
  });

/** Inferred TypeScript type for validated URL shortening request bodies. */
export type ShortenBody = z.infer<typeof ShortenBodySchema>;

/**
 * Zod schema for validating short code path parameters (`/:shortCode`).
 */
export const ShortCodeParamSchema = z.object({
  shortCode: z.string().regex(/^[A-Za-z0-9_-]{3,32}$/, 'invalid short code'),
});
