import { prisma } from '../db.js';
import { logger } from '../logger.js';

export interface ClickData {
  linkId: string; // BigInt as string
  referrer: string | null;
  userAgent: string | null;
  ipCountry: string;
}

/**
 * Guarded, non-blocking click write. Callers invoke WITHOUT awaiting so the
 * redirect response is never delayed by analytics persistence. Any failure is
 * logged and swallowed — a lost click must never break a redirect.
 *
 * Deferred upgrade path (out of scope): under high write load, replace this
 * direct INSERT with a push to Redis Streams drained by a batch worker.
 */
export function recordClick(data: ClickData): void {
  prisma.click
    .create({
      data: {
        linkId: BigInt(data.linkId),
        referrer: data.referrer,
        userAgent: data.userAgent,
        ipCountry: data.ipCountry,
      },
    })
    .catch((err: unknown) => {
      logger.error(
        { err: (err as Error).message, linkId: data.linkId },
        'failed to record click',
      );
    });
}
