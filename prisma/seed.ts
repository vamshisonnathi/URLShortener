import { PrismaClient } from '@prisma/client';

// Idempotent sample data for local exploration. Uses fixed short codes so
// re-running upserts rather than duplicating. Safe to run repeatedly.
const prisma = new PrismaClient();

const DAY = 86_400_000;

interface Seed {
  shortCode: string;
  originalUrl: string;
  customAlias?: string;
  expiresAt?: Date | null;
  isActive?: boolean;
  clicks: Array<{ referrer: string | null; ipCountry: string; daysAgo: number }>;
}

const seeds: Seed[] = [
  {
    shortCode: 'demoGH1',
    originalUrl: 'https://github.com/features/actions',
    clicks: [
      { referrer: 'https://news.ycombinator.com/', ipCountry: 'US', daysAgo: 2 },
      { referrer: 'https://news.ycombinator.com/', ipCountry: 'US', daysAgo: 0 },
      { referrer: 'https://twitter.com/', ipCountry: 'DE', daysAgo: 1 },
      { referrer: null, ipCountry: 'IN', daysAgo: 0 },
    ],
  },
  {
    shortCode: 'launch',
    customAlias: 'launch',
    originalUrl: 'https://example.com/product/launch',
    expiresAt: new Date(Date.now() + 30 * DAY),
    clicks: [
      { referrer: 'https://www.reddit.com/', ipCountry: 'GB', daysAgo: 3 },
      { referrer: 'https://www.reddit.com/', ipCountry: 'US', daysAgo: 1 },
    ],
  },
  {
    shortCode: 'expired',
    originalUrl: 'https://example.com/old-campaign',
    expiresAt: new Date(Date.now() - 1 * DAY), // already expired -> 410 on redirect
    clicks: [],
  },
];

async function main(): Promise<void> {
  for (const seed of seeds) {
    // Replace any prior row for this code so click counts stay deterministic.
    await prisma.link.deleteMany({ where: { shortCode: seed.shortCode } });

    const link = await prisma.link.create({
      data: {
        shortCode: seed.shortCode,
        originalUrl: seed.originalUrl,
        customAlias: seed.customAlias ?? null,
        expiresAt: seed.expiresAt ?? null,
        isActive: seed.isActive ?? true,
      },
    });

    if (seed.clicks.length > 0) {
      await prisma.click.createMany({
        data: seed.clicks.map((c) => ({
          linkId: link.id,
          referrer: c.referrer,
          userAgent: 'seed-script',
          ipCountry: c.ipCountry,
          clickedAt: new Date(Date.now() - c.daysAgo * DAY),
        })),
      });
    }

    console.log(`seeded ${seed.shortCode} (${seed.clicks.length} clicks)`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
