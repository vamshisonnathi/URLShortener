import type { FastifyInstance } from 'fastify';
import { ShortenBodySchema } from '../lib/validation.js';
import { createShortLink } from '../services/shorten.js';
import { consumeToken } from '../services/rateLimit.js';
import { AppError } from '../services/errors.js';

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
