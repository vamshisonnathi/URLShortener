import { prisma } from '../db.js';
import { getCachedLink, setCachedLink, type CachedLink } from './cache.js';

// Read-through resolution: Redis first, then Postgres, then backfill the cache.
// Returns null when the code does not exist at all.
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
