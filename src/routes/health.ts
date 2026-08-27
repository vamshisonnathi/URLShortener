import type { FastifyInstance } from 'fastify';
import { pingDb } from '../db.js';
import { pingRedis } from '../redis.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_request, reply) => {
    const [db, redis] = await Promise.all([pingDb(), pingRedis()]);

    // Liveness requires the DB (source of truth). Redis is best-effort: the app
    // degrades to Postgres when it is down, so a Redis outage is degraded, not
    // dead. DB down => 503.
    const status = db ? 'ok' : 'error';
    const code = db ? 200 : 503;

    return reply.status(code).send({
      status,
      checks: {
        db: db ? 'up' : 'down',
        redis: redis ? 'up' : 'down',
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });
}
