import { Redis } from 'ioredis';
import { config } from './config.js';
import { logger } from './logger.js';

// Single shared connection. `lazyConnect` lets the process boot even when Redis
// is down; callers must treat Redis as best-effort and fall back to Postgres.
export const redis = new Redis(config.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  // Keep reconnecting in the background; degrade gracefully in the meantime.
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
  // Rate-limited by ioredis internally; log at warn to avoid masking real issues.
  ready = false;
  logger.warn({ err: err.message }, 'redis error');
});

export function redisAvailable(): boolean {
  return ready && redis.status === 'ready';
}

// Attempt an initial connection but never block startup on it.
export async function initRedis(): Promise<void> {
  try {
    await redis.connect();
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'redis initial connect failed; degrading to Postgres');
  }
}

export async function pingRedis(): Promise<boolean> {
  try {
    if (!redisAvailable()) return false;
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}
