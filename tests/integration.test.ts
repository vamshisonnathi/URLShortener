import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

// Configure env BEFORE importing modules that read it at load time.
// Point at the docker-compose Postgres (localhost) unless overridden.
process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:5432/urlshortener?schema=public';
// Use a DB name that is unlikely to collide with real Redis keys; Redis is
// optional here — if it is down the app degrades to Postgres.
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.SHORT_URL_BASE ??= 'http://localhost:3000';
process.env.LOG_LEVEL ??= 'silent';

// Dynamic imports so the env above is in place first.
const { buildApp } = await import('../src/app.js');
const { prisma } = await import('../src/db.js');
const { redis } = await import('../src/redis.js');

let app: FastifyInstance;
const createdCodes: string[] = [];

beforeAll(async () => {
  app = buildApp();
  await app.ready();
});

afterAll(async () => {
  // Clean up rows this suite created (clicks cascade on link delete).
  if (createdCodes.length > 0) {
    await prisma.link.deleteMany({ where: { shortCode: { in: createdCodes } } });
  }
  await app.close();
  await prisma.$disconnect();
  redis.disconnect();
});

// The click write is intentionally fire-and-forget; poll analytics until the
// expected count lands (or time out).
async function waitForClicks(shortCode: string, expected: number, timeoutMs = 5000): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  let last = 0;
  while (Date.now() < deadline) {
    const res = await app.inject({ method: 'GET', url: `/api/analytics/${shortCode}` });
    last = res.json().totalClicks;
    if (last >= expected) return last;
    await new Promise((r) => setTimeout(r, 100));
  }
  return last;
}

describe('shorten -> redirect -> analytics', () => {
  it('completes the full flow with a 302 redirect and recorded analytics', async () => {
    const target = 'https://example.com/some/deep/path?ref=test';

    // 1) shorten
    const shortenRes = await app.inject({
      method: 'POST',
      url: '/api/shorten',
      payload: { url: target },
    });
    expect(shortenRes.statusCode).toBe(201);
    const body = shortenRes.json();
    expect(body.shortCode).toHaveLength(7);
    expect(body.shortUrl).toBe(`http://localhost:3000/${body.shortCode}`);
    expect(body.expiresAt).toBeNull();
    const { shortCode } = body;
    createdCodes.push(shortCode);

    // 2) redirect (302, not 301) with click attribution headers
    const redirectRes = await app.inject({
      method: 'GET',
      url: `/${shortCode}`,
      headers: { referer: 'https://news.ycombinator.com/', 'cf-ipcountry': 'US' },
    });
    expect(redirectRes.statusCode).toBe(302);
    expect(redirectRes.headers.location).toBe(target);

    // second click from a different country/referrer
    await app.inject({
      method: 'GET',
      url: `/${shortCode}`,
      headers: { referer: 'https://twitter.com/', 'cf-ipcountry': 'DE' },
    });

    // 3) analytics reflects both clicks
    const total = await waitForClicks(shortCode, 2);
    expect(total).toBe(2);

    const analytics = (await app.inject({ method: 'GET', url: `/api/analytics/${shortCode}` })).json();
    expect(analytics.shortCode).toBe(shortCode);
    expect(analytics.totalClicks).toBe(2);
    expect(analytics.clicksByDay.length).toBeGreaterThanOrEqual(1);
    expect(analytics.topReferrers).toEqual(
      expect.arrayContaining([
        { referrer: 'https://news.ycombinator.com/', clicks: 1 },
        { referrer: 'https://twitter.com/', clicks: 1 },
      ]),
    );
    expect(analytics.topCountries).toEqual(
      expect.arrayContaining([
        { country: 'US', clicks: 1 },
        { country: 'DE', clicks: 1 },
      ]),
    );
  });

  it('honors a custom alias and 409s on reuse', async () => {
    const alias = `it-${Date.now().toString(36)}`;
    createdCodes.push(alias);

    const first = await app.inject({
      method: 'POST',
      url: '/api/shorten',
      payload: { url: 'https://example.org', customAlias: alias },
    });
    expect(first.statusCode).toBe(201);
    expect(first.json().shortCode).toBe(alias);

    const dup = await app.inject({
      method: 'POST',
      url: '/api/shorten',
      payload: { url: 'https://example.net', customAlias: alias },
    });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error).toBe('ALIAS_TAKEN');
  });

  it('404s an unknown code and 410s an expired link', async () => {
    // unknown
    const missing = await app.inject({ method: 'GET', url: '/doesnotexist123' });
    expect(missing.statusCode).toBe(404);

    // expired: insert directly with a past expiry, then hit redirect
    const code = `exp${Date.now().toString(36)}`.slice(0, 7);
    createdCodes.push(code);
    await prisma.link.create({
      data: {
        shortCode: code,
        originalUrl: 'https://example.com',
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    const gone = await app.inject({ method: 'GET', url: `/${code}` });
    expect(gone.statusCode).toBe(410);
  });

  it('rejects an invalid url with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/shorten',
      payload: { url: 'ftp://nope.example.com' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('VALIDATION_ERROR');
  });

  it('health reports db connectivity', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().checks.db).toBe('up');
  });
});
