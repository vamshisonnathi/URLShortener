import { PrismaClient } from '@prisma/client';
import { config } from './config.js';

export const prisma = new PrismaClient({
  datasources: { db: { url: config.DATABASE_URL } },
  // Only 'warn'. Expected unique-constraint conflicts (alias 409, generated-code
  // retry) are caught and handled in-code, so they must not surface as errors.
  // Genuine unhandled errors are logged by the Fastify error handler in app.ts.
  log: ['warn'],
});

// Lightweight liveness probe for /health.
export async function pingDb(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
