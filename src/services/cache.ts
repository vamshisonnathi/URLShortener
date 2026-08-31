/**
 * @file Redis Read-Through Cache Service
 * @description High-performance caching layer for short code lookups with graceful fallback on Redis failure.
 * @module services/cache
 */

import { redis, redisAvailable } from '../redis.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

/**
 * Structure of a cached short link entry stored in Redis.
 * Includes `linkId` and `expiresAt` so redirects avoid secondary database lookups.
 */
export interface CachedLink {
  /** Database BigInt primary key serialized as a string. */
  linkId: string;
  /** Original destination URL. */
  originalUrl: string;
  /** Expiration timestamp in ISO-8601 string format, or `null`. */
  expiresAt: string | null;
  /** Link active status. */
  isActive: boolean;
}

/**
 * Constructs a Redis cache key for a given short code.
 *
 * @param code - The short code string.
 * @returns Formatted Redis key (e.g. `link:aZ3kR9p`).
 */
function key(code: string): string {
  return `link:${code}`;
}

/**
 * Retrieves a cached link resolution payload from Redis.
 *
 * @param code - The short code to look up.
 * @returns Promise resolving to `CachedLink` if found in cache, or `null` if missed/unavailable.
 */
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

/**
 * Stores a link resolution payload in Redis with bounded TTL.
 *
 * The cache TTL is set to `min(CACHE_TTL_SECONDS, secondsToExpiry)` to guarantee
 * that expired links are evicted immediately upon passing their expiration date.
 *
 * @param code - The short code string.
 * @param link - The link metadata to cache.
 */
export async function setCachedLink(code: string, link: CachedLink): Promise<void> {
  if (!redisAvailable()) return;
  try {
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

/**
 * Deletes a cached link entry from Redis (e.g. upon link update or deactivation).
 *
 * @param code - The short code string to invalidate.
 */
export async function invalidateCachedLink(code: string): Promise<void> {
  if (!redisAvailable()) return;
  try {
    await redis.del(key(code));
  } catch (err) {
    logger.warn({ err: (err as Error).message, code }, 'cache invalidate failed');
  }
}
