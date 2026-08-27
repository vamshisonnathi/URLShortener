import { redis, redisAvailable } from '../redis.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

// Atomic token-bucket in one round-trip. Refills based on wall-clock elapsed
// since the last request, caps at capacity, and consumes one token if present.
// Returns { allowed, remaining, retryAfter(seconds) }.
const TOKEN_BUCKET_LUA = `
local key        = KEYS[1]
local capacity   = tonumber(ARGV[1])
local refill     = tonumber(ARGV[2])   -- tokens per second
local now        = tonumber(ARGV[3])   -- ms
local requested  = tonumber(ARGV[4])

local data = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(data[1])
local ts = tonumber(data[2])

if tokens == nil then
  tokens = capacity
  ts = now
end

local elapsed = math.max(0, now - ts) / 1000
tokens = math.min(capacity, tokens + elapsed * refill)

local allowed = 0
if tokens >= requested then
  allowed = 1
  tokens = tokens - requested
end

-- Expire idle buckets: time to fully refill from empty, +1s slack.
local ttl = math.ceil(capacity / refill) + 1
redis.call('HMSET', key, 'tokens', tokens, 'ts', now)
redis.call('EXPIRE', key, ttl)

local retry_after = 0
if allowed == 0 then
  retry_after = math.ceil((requested - tokens) / refill)
end

return { allowed, math.floor(tokens), retry_after }
`;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number; // seconds
  limit: number;
}

export async function consumeToken(ip: string): Promise<RateLimitResult> {
  const limit = config.RATE_LIMIT_CAPACITY;

  // Graceful degradation: if Redis is unreachable, allow the request rather
  // than returning 500. Log so the gap is observable.
  if (!redisAvailable()) {
    logger.warn({ ip }, 'rate limiter unavailable (redis down); allowing request');
    return { allowed: true, remaining: limit, retryAfter: 0, limit };
  }

  try {
    const res = (await redis.eval(
      TOKEN_BUCKET_LUA,
      1,
      `ratelimit:shorten:${ip}`,
      String(config.RATE_LIMIT_CAPACITY),
      String(config.RATE_LIMIT_REFILL_PER_SEC),
      String(Date.now()),
      '1',
    )) as [number, number, number];

    const [allowed, remaining, retryAfter] = res;
    return { allowed: allowed === 1, remaining, retryAfter, limit };
  } catch (err) {
    logger.warn({ err: (err as Error).message, ip }, 'rate limiter error; allowing request');
    return { allowed: true, remaining: limit, retryAfter: 0, limit };
  }
}
