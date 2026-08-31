/**
 * @file HTTP Redirect Route Handler
 * @description Serves HTTP 302 Found redirects for short codes and triggers asynchronous click attribution.
 * @module routes/redirect
 */

import type { FastifyInstance } from 'fastify';
import { ShortCodeParamSchema } from '../lib/validation.js';
import { resolveLink } from '../services/resolve.js';
import { recordClick } from '../services/click.js';
import { isServable, isExpired } from '../lib/expiry.js';

/**
 * Extracts ISO country code from upstream CDN/load-balancer headers (`CF-IPCountry` or `X-Country`).
 *
 * @param headers - HTTP request headers object.
 * @returns Upper-case 2-letter country code string, or `'XX'` default.
 */
function countryFromHeaders(headers: Record<string, unknown>): string {
  const raw = headers['cf-ipcountry'] ?? headers['x-country'];
  const val = Array.isArray(raw) ? raw[0] : raw;
  return typeof val === 'string' && val.trim() !== '' ? val.trim().toUpperCase() : 'XX';
}

/**
 * Registers short code redirect catch-all route on the Fastify instance.
 *
 * Route: `GET /:shortCode`
 * - 302 Found: Redirects to target URL (302 is enforced so browser caching doesn't bypass analytics).
 * - 404 Not Found: If short code does not exist.
 * - 410 Gone: If the short code has expired or is inactive.
 *
 * @param app - The Fastify application instance.
 */
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

    // Record click WITHOUT awaiting so the redirect is not delayed.
    recordClick({
      linkId: link.linkId,
      referrer: (request.headers['referer'] as string | undefined) ?? null,
      userAgent: (request.headers['user-agent'] as string | undefined) ?? null,
      ipCountry: countryFromHeaders(request.headers as Record<string, unknown>),
    });

    // 302 Found (not 301) is deliberate to ensure every click reaches the server.
    return reply.redirect(link.originalUrl, 302);
  });
}
