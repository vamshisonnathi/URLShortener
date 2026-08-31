/**
 * @file Analytics HTTP Route Handler
 * @description Exposes `GET /api/analytics/:shortCode` for inspecting click metrics.
 * @module routes/analytics
 */

import type { FastifyInstance } from 'fastify';
import { ShortCodeParamSchema } from '../lib/validation.js';
import { getAnalytics } from '../services/analytics.js';

/**
 * Registers analytics HTTP endpoints on the Fastify instance.
 *
 * Route: `GET /api/analytics/:shortCode`
 * - 200 OK: Returns `AnalyticsResult` (total clicks, clicks by day, top referrers, top countries).
 * - 404 Not Found: If the short code is malformed or does not exist.
 *
 * @param app - The Fastify application instance.
 */
export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/analytics/:shortCode', async (request, reply) => {
    const parsed = ShortCodeParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'unknown short code' });
    }

    const result = await getAnalytics(parsed.data.shortCode);
    if (!result) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'unknown short code' });
    }
    return reply.send(result);
  });
}
