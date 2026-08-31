/**
 * @file Application Server Entrypoint
 * @description Boots Fastify HTTP server, initializes datastore connections, and handles graceful shutdown on OS signals.
 * @module server
 */

import { buildApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { prisma } from './db.js';
import { redis, initRedis } from './redis.js';

/**
 * Main application bootstrap function.
 *
 * Sequence:
 * 1. Best-effort Redis initial connection (`initRedis()`).
 * 2. Builds Fastify app instance (`buildApp()`).
 * 3. Listens on configured host/port (`config.HOST`, `config.PORT`).
 * 4. Registers `SIGTERM` and `SIGINT` signal handlers for graceful shutdown (draining requests, closing DB/Redis pools).
 */
async function main(): Promise<void> {
  // Best-effort Redis connect; never blocks startup (graceful degradation).
  await initRedis();

  const app = buildApp();
  await app.listen({ port: config.PORT, host: config.HOST });
  logger.info({ port: config.PORT, host: config.HOST }, 'server listening');

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down');
    try {
      // 1) Stop accepting new connections, drain in-flight requests.
      await app.close();
      // 2) Close downstream resources.
      await prisma.$disconnect();
      redis.disconnect();
      logger.info('shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'error during shutdown');
      process.exit(1);
    }
  };

  for (const sig of ['SIGTERM', 'SIGINT'] as const) {
    process.on(sig, () => void shutdown(sig));
  }
}

main().catch((err) => {
  logger.fatal({ err: (err as Error).message }, 'fatal startup error');
  process.exit(1);
});
