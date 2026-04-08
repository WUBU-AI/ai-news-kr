import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = 20;
  const skip = (page - 1) * limit;
  const category = searchParams.get('category') || null;
  const tag = searchParams.get('tag') || null;
  const includeUntranslated = searchParams.get('untranslated') === 'true';

  try {
    const translatedWhere = {
      translatedTitle: { not: null },
      ...(category ? { category } : {}),
      ...(tag ? { tags: { has: tag } } : {}),
    };

    const [articles, total, lastLog] = await Promise.all([
      prisma.article.findMany({
        where: translatedWhere,
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
      prisma.article.count({ where: translatedWhere }),
      prisma.collectionLog.findFirst({
        orderBy: { runAt: 'desc' },
        select: { runAt: true, articlesCollected: true, status: true },
      }),
    ]);

    // Fetch untranslated articles (score-filtered out) if requested or on page 1 with no filters
    let untranslatedArticles: { id: string; originalTitle: string; importanceScore: number; sourceUrl: string; sourceName: string; publishedAt: Date | null }[] = [];
    if (includeUntranslated && !category && !tag) {
      untranslatedArticles = await prisma.article.findMany({
        where: { translatedTitle: null },
        orderBy: [{ importanceScore: 'desc' }, { publishedAt: 'desc' }],
        take: 30,
        select: {
          id: true,
          originalTitle: true,
          importanceScore: true,
          sourceUrl: true,
          sourceName: true,
          publishedAt: true,
        },
      });
    }

    return NextResponse.json({
      articles,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      lastCollected: lastLog?.runAt ?? null,
      untranslatedArticles,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
