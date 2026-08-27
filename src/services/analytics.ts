import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';

export interface AnalyticsResult {
  shortCode: string;
  totalClicks: number;
  clicksByDay: Array<{ day: string; clicks: number }>;
  topReferrers: Array<{ referrer: string; clicks: number }>;
  topCountries: Array<{ country: string; clicks: number }>;
}

const TOP_N = 10;

// Aggregation is pushed into Postgres and served by the (link_id, clicked_at)
// composite index — no SELECT * + in-memory filtering.
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
