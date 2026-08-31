import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { config } from './config.js';
import { shortenRoutes } from './routes/shorten.js';
import { redirectRoutes } from './routes/redirect.js';
import { analyticsRoutes } from './routes/analytics.js';
import { healthRoutes } from './routes/health.js';

import { uiRoutes } from './routes/ui.js';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    // Fastify's built-in logger IS pino; configure it directly so it builds a
    // correctly-typed instance and adds per-request child loggers with reqId.
    logger: {
      level: config.LOG_LEVEL,
      base: { service: 'url-shortener' },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    // Trust proxy so request.ip / X-Forwarded-For work behind a LB/CDN.
    trustProxy: true,
    // Attach/propagate a request id for structured tracing.
    genReqId: (req) => (req.headers['x-request-id'] as string) ?? randomUUID(),
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'reqId',
  });

  app.register(uiRoutes);
  app.register(healthRoutes);
  app.register(shortenRoutes);
  app.register(analyticsRoutes);
  // Redirect route is a catch-all `/:shortCode`; register last so it never
  // shadows the more specific /api, /health, and / routes.
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
