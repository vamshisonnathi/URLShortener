/**
 * @file Short Link Creation Service
 * @description Creates short URLs with optional custom alias reservation and unique collision retry logic.
 * @module services/shorten
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { generateCode, DEFAULT_CODE_LENGTH } from '../lib/base62.js';
import { config } from '../config.js';
import { AliasConflictError, CodeGenerationError } from './errors.js';
import type { ShortenBody } from '../lib/validation.js';

/** Maximum collision retry attempts for generated Base62 short codes. */
const MAX_CODE_RETRIES = 5;

/**
 * Checks whether an error is a Prisma unique constraint violation (P2002).
 *
 * @param err - Unknown error object.
 * @returns `true` if unique constraint error, otherwise `false`.
 */
function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

/**
 * Output data structure returned when a short link is created successfully.
 */
export interface ShortenResult {
  /** Generated code or custom alias string. */
  shortCode: string;
  /** Full clickable short URL string (e.g. `http://localhost:3000/aZ3kR9p`). */
  shortUrl: string;
  /** ISO-8601 expiration timestamp, or `null`. */
  expiresAt: string | null;
}

/**
 * Creates a new short URL record in PostgreSQL.
 *
 * Execution Logic:
 * - If `customAlias` is supplied: attempts single database insertion. Maps unique constraint failure to `AliasConflictError` (HTTP 409).
 * - If `customAlias` is omitted: generates an unbiased 7-char Base62 code and attempts insert. On collision (P2002), retries up to 5 times.
 *
 * @param body - Validated request body (`url`, `customAlias`, `expiresAt`).
 * @returns Promise resolving to `ShortenResult`.
 * @throws {AliasConflictError} If `customAlias` is already claimed.
 * @throws {CodeGenerationError} If unique code generation fails after 5 retries.
 */
export async function createShortLink(body: ShortenBody): Promise<ShortenResult> {
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

  // Custom alias path: single insert, map unique-constraint to 409.
  if (body.customAlias) {
    try {
      const link = await prisma.link.create({
        data: {
          shortCode: body.customAlias,
          originalUrl: body.url,
          customAlias: body.customAlias,
          expiresAt,
        },
      });
      return toResult(link.shortCode, expiresAt);
    } catch (err) {
      if (isUniqueViolation(err)) throw new AliasConflictError(body.customAlias);
      throw err;
    }
  }

  // Generated code path: retry on the (rare) unique-constraint collision.
  for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
    const shortCode = generateCode(DEFAULT_CODE_LENGTH);
    try {
      const link = await prisma.link.create({
        data: { shortCode, originalUrl: body.url, expiresAt },
      });
      return toResult(link.shortCode, expiresAt);
    } catch (err) {
      if (isUniqueViolation(err)) continue; // collision: try a fresh code
      throw err;
    }
  }
  throw new CodeGenerationError();
}

/**
 * Helper function mapping a short code and expiration date to a `ShortenResult` object.
 *
 * @param shortCode - Short code or custom alias.
 * @param expiresAt - Expiration date or `null`.
 * @returns `ShortenResult` object.
 */
function toResult(shortCode: string, expiresAt: Date | null): ShortenResult {
  return {
    shortCode,
    shortUrl: `${config.SHORT_URL_BASE}/${shortCode}`,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
  };
}
