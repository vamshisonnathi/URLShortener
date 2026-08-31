/**
 * @file Analytics Aggregation Service
 * @description Serves indexed SQL analytical aggregations (clicks by day, top referrers, top countries).
 * @module services/analytics
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';

/**
 * Analytical output structure representing click metrics for a short link.
 */
export interface AnalyticsResult {
  /** The short code being inspected. */
  shortCode: string;
  /** Cumulative total clicks recorded for this short code. */
  totalClicks: number;
  /** Chronological breakdown of click counts per day (YYYY-MM-DD format). */
  clicksByDay: Array<{ day: string; clicks: number }>;
  /** Top referrer domains sorted by click count (up to 10 entries). */
  topReferrers: Array<{ referrer: string; clicks: number }>;
  /** Top country codes (ISO alpha-2) sorted by click count (up to 10 entries). */
  topCountries: Array<{ country: string; clicks: number }>;
}

/** Maximum number of top referrers and countries to return. */
const TOP_N = 10;

/**
 * Fetches and aggregates click analytics for a given short code.
 *
 * Aggregations are executed directly inside PostgreSQL using `$queryRaw` SQL queries
 * backed by the `(link_id, clicked_at)` composite index, avoiding full-table scans
 * or in-memory filtering in Node.js.
 *
 * @param shortCode - The unique short code to look up.
 * @returns Promise resolving to `AnalyticsResult` if found, or `null` if shortCode does not exist.
 */
export async function getAnalytics(shortCode: string): Promise<AnalyticsResult | null> {
  const link = await prisma.link.findUnique({
    where: { shortCode },
    select: { id: true },
  });
  if (!link) return null;

  const linkId = link.id;

  const [byDay, referrers, countries] = await Promise.all([
    prisma.$queryRaw<Array<{ day: Date; clicks: bigint }>>(Prisma.sql`
      SELECT date_trunc('day', clicked_at) AS day, COUNT(*) AS clicks
      FROM clicks
      WHERE link_id = ${linkId}
      GROUP BY 1
      ORDER BY 1 ASC
    `),
    prisma.$queryRaw<Array<{ referrer: string | null; clicks: bigint }>>(Prisma.sql`
      SELECT referrer, COUNT(*) AS clicks
      FROM clicks
      WHERE link_id = ${linkId}
      GROUP BY referrer
      ORDER BY clicks DESC, referrer ASC
      LIMIT ${TOP_N}
    `),
    prisma.$queryRaw<Array<{ ip_country: string; clicks: bigint }>>(Prisma.sql`
      SELECT ip_country, COUNT(*) AS clicks
      FROM clicks
      WHERE link_id = ${linkId}
      GROUP BY ip_country
      ORDER BY clicks DESC, ip_country ASC
      LIMIT ${TOP_N}
    `),
  ]);

  const totalClicks = byDay.reduce((sum, row) => sum + Number(row.clicks), 0);

  return {
    shortCode,
    totalClicks,
    clicksByDay: byDay.map((r) => ({
      day: r.day.toISOString().slice(0, 10), // YYYY-MM-DD
      clicks: Number(r.clicks),
    })),
    topReferrers: referrers.map((r) => ({
      referrer: r.referrer ?? 'direct',
      clicks: Number(r.clicks),
    })),
    topCountries: countries.map((r) => ({
      country: r.ip_country,
      clicks: Number(r.clicks),
    })),
  };
}
