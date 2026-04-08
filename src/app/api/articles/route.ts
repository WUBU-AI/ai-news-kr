import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = 20;
  const skip = (page - 1) * limit;

  try {
    const [articles, total, lastLog] = await Promise.all([
      prisma.article.findMany({
        where: { translatedTitle: { not: null } },
        orderBy: [{ importanceScore: 'desc' }, { publishedAt: 'desc' }],
        skip,
        take: limit,
        select: {
          id: true,
          translatedTitle: true,
          originalTitle: true,
          summaryBullets: true,
          importanceScore: true,
          category: true,
          tags: true,
          sourceName: true,
          sourceUrl: true,
          publishedAt: true,
          collectedAt: true,
        },
      }),
      prisma.article.count({ where: { translatedTitle: { not: null } } }),
      prisma.collectionLog.findFirst({
        orderBy: { runAt: 'desc' },
        select: { runAt: true, articlesCollected: true, status: true },
      }),
    ]);

    return NextResponse.json({
      articles,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      lastCollected: lastLog?.runAt ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
