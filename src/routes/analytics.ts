import type { FastifyInstance } from 'fastify';
import { ShortCodeParamSchema } from '../lib/validation.js';
import { getAnalytics } from '../services/analytics.js';

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
