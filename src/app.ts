/**
 * @file Fastify Application Builder
 * @description Configures Fastify instance, Pino logging, request ID tracing, route registrations, and error handlers.
 * @module app
 */

import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { config } from './config.js';
import { shortenRoutes } from './routes/shorten.js';
import { redirectRoutes } from './routes/redirect.js';
import { analyticsRoutes } from './routes/analytics.js';
import { healthRoutes } from './routes/health.js';
import { uiRoutes } from './routes/ui.js';

/**
 * Builds and configures the Fastify server application instance.
 *
 * Configures:
 * - Structured ISO timestamp logging via Pino.
 * - `trustProxy: true` for accurate IP detection behind reverse proxies/CDNs.
 * - Automatic `x-request-id` header propagation / UUID generation.
 * - Route plugins (`uiRoutes`, `healthRoutes`, `shortenRoutes`, `analyticsRoutes`, `redirectRoutes`).
 * - Global 404 and 500 error handling middleware.
 *
 * @returns Configured `FastifyInstance`.
 */
export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      base: { service: 'url-shortener' },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    trustProxy: true,
    genReqId: (req) => (req.headers['x-request-id'] as string) ?? randomUUID(),
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'reqId',
  });

  app.register(uiRoutes);
  app.register(healthRoutes);
  app.register(shortenRoutes);
  app.register(analyticsRoutes);
  // Redirect route is a catch-all `/:shortCode`; register last so it never shadows specific routes.
  app.register(redirectRoutes);

  app.setErrorHandler((err, request, reply) => {
    request.log.error({ err }, 'unhandled request error');
    reply.status(err.statusCode ?? 500).send({
      error: 'INTERNAL_ERROR',
      message: 'an unexpected error occurred',
    });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ error: 'NOT_FOUND', message: 'resource not found' });
  });

  return app;
}
