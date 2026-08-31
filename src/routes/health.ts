/**
 * @file System Health Check Route Handler
 * @description Exposes `GET /health` for liveness and datastore dependency checks (PostgreSQL & Redis).
 * @module routes/health
 */

import type { FastifyInstance } from 'fastify';
import { pingDb } from '../db.js';
import { pingRedis } from '../redis.js';

/**
 * Registers health check HTTP endpoints on the Fastify instance.
 *
 * Route: `GET /health`
 * - 200 OK: If PostgreSQL is reachable (`checks.db === 'up'`). Redis status (`up`/`down`) is reported independently.
 * - 503 Service Unavailable: If PostgreSQL (source of truth) is unreachable.
 *
 * @param app - The Fastify application instance.
 */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_request, reply) => {
    const [db, redis] = await Promise.all([pingDb(), pingRedis()]);

    // Liveness requires PostgreSQL (source of truth).
    // Redis is an optimization layer; if Redis is down, the system degrades to DB lookups and reports 200 OK with `redis: "down"`.
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
