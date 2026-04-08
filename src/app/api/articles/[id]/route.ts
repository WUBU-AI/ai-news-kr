import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const article = await prisma.article.findUnique({
      where: { id: params.id },
    });

    if (!article) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Increment view count
    await prisma.article.update({
      where: { id: params.id },
      data: { viewCount: { increment: 1 } },
    });

    // Related articles: same category, excluding current
    const related = await prisma.article.findMany({
      where: {
        category: article.category ?? undefined,
        id: { not: params.id },
        translatedTitle: { not: null },
      },
      orderBy: { publishedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        translatedTitle: true,
        importanceScore: true,
        category: true,
        sourceName: true,
        publishedAt: true,
      },
    });

    return NextResponse.json({ article, related });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
