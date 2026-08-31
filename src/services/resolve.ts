/**
 * @file Read-Through Link Resolution Service
 * @description Resolves short codes to original destination URLs via Redis cache with PostgreSQL fallback.
 * @module services/resolve
 */

import { prisma } from '../db.js';
import { getCachedLink, setCachedLink, type CachedLink } from './cache.js';

/**
 * Resolves a short code to its cached metadata via read-through lookup strategy.
 *
 * Sequence:
 * 1. Checks Redis cache first for hit (`getCachedLink`).
 * 2. If missed, queries PostgreSQL `Link` table.
 * 3. On DB hit, asynchronously backfills the Redis cache (`setCachedLink`) and returns metadata.
 * 4. Returns `null` if code does not exist.
 *
 * @param code - The short code or custom alias to resolve.
 * @returns Promise resolving to `CachedLink` if found, or `null` if non-existent.
 */
export async function resolveLink(code: string): Promise<CachedLink | null> {
  const cached = await getCachedLink(code);
  if (cached) return cached;

  const link = await prisma.link.findUnique({
    where: { shortCode: code },
    select: { id: true, originalUrl: true, expiresAt: true, isActive: true },
  });
  if (!link) return null;

  const value: CachedLink = {
    linkId: link.id.toString(),
    originalUrl: link.originalUrl,
    expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
    isActive: link.isActive,
  };

  // Best-effort backfill; failures are swallowed inside setCachedLink.
  await setCachedLink(code, value);
  return value;
}
