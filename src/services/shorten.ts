import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { generateCode, DEFAULT_CODE_LENGTH } from '../lib/base62.js';
import { config } from '../config.js';
import { AliasConflictError, CodeGenerationError } from './errors.js';
import type { ShortenBody } from '../lib/validation.js';

const MAX_CODE_RETRIES = 5;

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

export interface ShortenResult {
  shortCode: string;
  shortUrl: string;
  expiresAt: string | null;
}

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

function toResult(shortCode: string, expiresAt: Date | null): ShortenResult {
  return {
    shortCode,
    shortUrl: `${config.SHORT_URL_BASE}/${shortCode}`,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
  };
}
