import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

// Isolated file: point Prisma at an UNREACHABLE database BEFORE importing any
// module that reads config, so /health exercises the DB-down contract (503).
// Vitest gives each test file its own module registry, so this does not affect
// the real-DB integration suite.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  'postgresql://postgres:postgres@127.0.0.1:59999/nonexistent?schema=public&connect_timeout=2';
process.env.REDIS_URL = 'redis://127.0.0.1:59998'; // also unreachable
process.env.SHORT_URL_BASE = 'http://localhost:3000';
process.env.LOG_LEVEL = 'silent';

const { buildApp } = await import('../src/app.js');
const { prisma } = await import('../src/db.js');

let app: FastifyInstance;

beforeAll(async () => {
  app = buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  // Never connected successfully; disconnect is best-effort.
  await prisma.$disconnect().catch(() => undefined);
});

describe('GET /health — dependency-down contracts', () => {
  it('returns 503 with status "error" when the database is unreachable', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body.status).toBe('error');
    expect(body.checks.db).toBe('down');
  });
});
