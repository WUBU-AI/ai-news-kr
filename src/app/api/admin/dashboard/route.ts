import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const [todayCount, recentLogs] = await Promise.all([
      prisma.article.count({
        where: { collectedAt: { gte: startOfDay } },
      }),
      prisma.collectionLog.findMany({
        orderBy: { runAt: 'desc' },
        take: 10,
      }),
    ]);

    return NextResponse.json({ todayCount, recentLogs });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
