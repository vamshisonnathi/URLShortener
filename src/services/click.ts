/**
 * @file Asynchronous Click Tracking Service
 * @description Non-blocking, fire-and-forget click persistence for HTTP redirects.
 * @module services/click
 */

import { prisma } from '../db.js';
import { logger } from '../logger.js';

/**
 * Click attribution data captured during a short link redirect.
 */
export interface ClickData {
  /** Target link's database BigInt primary key (as string). */
  linkId: string;
  /** HTTP Referer header string, or `null` if direct/none. */
  referrer: string | null;
  /** User-Agent header string, or `null`. */
  userAgent: string | null;
  /** ISO alpha-2 country code (e.g. `US`, `DE`), defaulting to `XX`. */
  ipCountry: string;
}

/**
 * Records a link click event asynchronously in the database.
 *
 * Invoked **without awaiting** on the HTTP redirect route path to ensure that analytics logging
 * never adds latency to user redirects. Exceptions are caught and logged so that database write errors
 * never crash or delay HTTP 302 responses.
 *
 * @param data - Click attribution fields (`linkId`, `referrer`, `userAgent`, `ipCountry`).
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
