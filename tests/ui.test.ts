import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

// Configure env BEFORE importing modules that read it at load time.
process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/urlshortener?schema=public';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.SHORT_URL_BASE ??= 'http://localhost:3000';
process.env.LOG_LEVEL ??= 'silent';

const { buildApp } = await import('../src/app.js');

let app: FastifyInstance;

beforeAll(async () => {
  app = buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('GET / (Web UI)', () => {
  it('serves the Web UI with 200 OK and text/html content-type', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('<title>URL Shortener');
    expect(res.body).toContain('id="shorten-form"');
    expect(res.body).toContain('id="analytics-code-input"');
  });
});
