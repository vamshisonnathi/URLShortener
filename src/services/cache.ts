import { redis, redisAvailable } from '../redis.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

// Cached resolution of a short code. Includes linkId + expiry so the redirect
// path can validate expiry and record a click without a second DB round-trip.
export interface CachedLink {
  linkId: string; // BigInt serialized as string
  originalUrl: string;
  expiresAt: string | null; // ISO-8601 or null
  isActive: boolean;
}

function key(code: string): string {
  return `link:${code}`;
}

export async function getCachedLink(code: string): Promise<CachedLink | null> {
  if (!redisAvailable()) return null;
  try {
    const raw = await redis.get(key(code));
    return raw ? (JSON.parse(raw) as CachedLink) : null;
  } catch (err) {
    logger.warn({ err: (err as Error).message, code }, 'cache read failed; falling back to DB');
    return null;
  }
}

export async function setCachedLink(code: string, link: CachedLink): Promise<void> {
  if (!redisAvailable()) return;
  try {
    // TTL is bounded by both the configured max and the link's own expiry so we
    // never serve a stale entry past expiration.
    let ttl = config.CACHE_TTL_SECONDS;
    if (link.expiresAt) {
      const secondsToExpiry = Math.floor((new Date(link.expiresAt).getTime() - Date.now()) / 1000);
      if (secondsToExpiry <= 0) return; // already expired; don't cache
      ttl = Math.min(ttl, secondsToExpiry);
    }
    await redis.set(key(code), JSON.stringify(link), 'EX', ttl);
  } catch (err) {
    logger.warn({ err: (err as Error).message, code }, 'cache write failed');
  }
}

export async function invalidateCachedLink(code: string): Promise<void> {
  if (!redisAvailable()) return;
  try {
    await redis.del(key(code));
  } catch (err) {
    logger.warn({ err: (err as Error).message, code }, 'cache invalidate failed');
  }
}
