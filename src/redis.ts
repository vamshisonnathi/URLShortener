/**
 * @file Redis Connection & Liveness Management
 * @description Configures ioredis connection with lazy initialization, event listeners, and liveness probing.
 * @module redis
 */

import { Redis } from 'ioredis';
import { config } from './config.js';
import { logger } from './logger.js';

/**
 * Singleton ioredis client instance configured for lazy connection.
 * Permits application startup even if Redis is temporarily unreachable.
 */
export const redis = new Redis(config.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  retryStrategy: (times) => Math.min(times * 200, 2000),
});

let ready = false;

redis.on('ready', () => {
  ready = true;
  logger.info('redis connected');
});
redis.on('end', () => {
  ready = false;
});
redis.on('error', (err) => {
  ready = false;
  logger.warn({ err: err.message }, 'redis error');
});

/**
 * Checks whether the shared Redis connection is alive and in `ready` state.
 *
 * @returns `true` if Redis is connected and ready to accept commands, otherwise `false`.
 */
export function redisAvailable(): boolean {
  return ready && redis.status === 'ready';
}

/**
 * Attempts non-blocking initial connection to Redis during server bootstrap.
 * Swallows connection errors to allow server startup with graceful PostgreSQL degradation.
 */
export async function initRedis(): Promise<void> {
  try {
    await redis.connect();
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'redis initial connect failed; degrading to Postgres');
  }
}

/**
 * Performs a `PING` health check against Redis.
 *
 * @returns Promise resolving to `true` if Redis responds with `'PONG'`, otherwise `false`.
 */
export async function pingRedis(): Promise<boolean> {
  try {
    if (!redisAvailable()) return false;
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}
