/**
 * @file Short URL Creation HTTP Route Handler
 * @description Exposes `POST /api/shorten` with Redis token-bucket rate limiting and Zod body validation.
 * @module routes/shorten
 */

import type { FastifyInstance } from 'fastify';
import { ShortenBodySchema } from '../lib/validation.js';
import { createShortLink } from '../services/shorten.js';
import { consumeToken } from '../services/rateLimit.js';
import { AppError } from '../services/errors.js';

/**
 * Registers URL shortening HTTP endpoints on the Fastify instance.
 *
 * Route: `POST /api/shorten`
 * - 201 Created: Returns `ShortenResult` (`shortCode`, `shortUrl`, `expiresAt`).
 * - 400 Bad Request: If request payload fails schema validation (`VALIDATION_ERROR`).
 * - 409 Conflict: If custom alias is taken (`ALIAS_TAKEN`).
 * - 429 Too Many Requests: If client IP exceeds token bucket rate limit (`RATE_LIMITED`).
 *
 * Header attributes set on all responses:
 * - `X-RateLimit-Limit`
 * - `X-RateLimit-Remaining`
 * - `Retry-After` (on 429 status)
 *
 * @param app - The Fastify application instance.
 */
export async function shortenRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/shorten', async (request, reply) => {
    // Per-IP token bucket. request.ip honors trustProxy (X-Forwarded-For).
    const rl = await consumeToken(request.ip);
    reply.header('X-RateLimit-Limit', rl.limit);
    reply.header('X-RateLimit-Remaining', Math.max(0, rl.remaining));
    if (!rl.allowed) {
      reply.header('Retry-After', rl.retryAfter);
      return reply.status(429).send({
        error: 'RATE_LIMITED',
        message: 'too many requests; slow down',
        retryAfter: rl.retryAfter,
      });
    }

    const parsed = ShortenBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'invalid request body',
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }

    try {
      const result = await createShortLink(parsed.data);
      return reply.status(201).send(result);
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.code, message: err.message });
      }
      throw err; // -> 500 via app error handler
    }
  });
}
