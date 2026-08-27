import type { FastifyInstance } from 'fastify';
import { ShortCodeParamSchema } from '../lib/validation.js';
import { resolveLink } from '../services/resolve.js';
import { recordClick } from '../services/click.js';
import { isServable, isExpired } from '../lib/expiry.js';

function countryFromHeaders(headers: Record<string, unknown>): string {
  // No geoip library (out of scope): trust an upstream/CDN-provided header.
  const raw = headers['cf-ipcountry'] ?? headers['x-country'];
  const val = Array.isArray(raw) ? raw[0] : raw;
  return typeof val === 'string' && val.trim() !== '' ? val.trim().toUpperCase() : 'XX';
}

export async function redirectRoutes(app: FastifyInstance): Promise<void> {
  app.get('/:shortCode', async (request, reply) => {
    const parsed = ShortCodeParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'unknown short code' });
    }
    const { shortCode } = parsed.data;

    const link = await resolveLink(shortCode);
    if (!link) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'unknown short code' });
    }

    const expirable = {
      expiresAt: link.expiresAt ? new Date(link.expiresAt) : null,
      isActive: link.isActive,
    };
    if (!isServable(expirable)) {
      const reason = isExpired(expirable) ? 'link has expired' : 'link is inactive';
      return reply.status(410).send({ error: 'GONE', message: reason });
    }

    // Record click WITHOUT awaiting so the redirect is not delayed. The write
    // is internally guarded (try/catch + log) in recordClick.
    recordClick({
      linkId: link.linkId,
      referrer: (request.headers['referer'] as string | undefined) ?? null,
      userAgent: (request.headers['user-agent'] as string | undefined) ?? null,
      ipCountry: countryFromHeaders(request.headers as Record<string, unknown>),
    });

    // 302 (not 301) is deliberate: 301 is cached client-side and bypasses the
    // server on repeat visits, corrupting click analytics.
    return reply.redirect(link.originalUrl, 302);
  });
}
