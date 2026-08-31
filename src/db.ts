/**
 * @file PostgreSQL Datastore Connection (Prisma)
 * @description Initializes Prisma Client instance and provides database ping liveness probing.
 * @module db
 */

import { PrismaClient } from '@prisma/client';
import { config } from './config.js';

/** Singleton Prisma Client instance for PostgreSQL database access. */
export const prisma = new PrismaClient({
  datasources: { db: { url: config.DATABASE_URL } },
  log: ['warn'],
});

/**
 * Lightweight PostgreSQL liveness probe for the `/health` endpoint.
 *
 * Executes `SELECT 1` against the database to verify connectivity.
 *
 * @returns Promise resolving to `true` if database is reachable, `false` otherwise.
 */
export async function pingDb(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
