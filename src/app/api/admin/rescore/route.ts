import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { scoreImportance, getScoreModel } from '@/lib/scorer';

// POST /api/admin/rescore
// Re-scores articles whose importanceScore is exactly 5.
// Query params:
//   ?all=true   — re-score every article regardless of current score
//   ?limit=N    — max articles to process per call (default 10, max 50)
// Uses score_model DB setting (default: ollama/qwen3:8b). No API key required.

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const rescoreAll = searchParams.get('all') === 'true';
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));

  const model = await getScoreModel();

  try {
    const articles = await prisma.article.findMany({
      where: rescoreAll ? undefined : { importanceScore: 5 },
      select: { id: true, originalTitle: true, originalContent: true },
      orderBy: { collectedAt: 'desc' },
      take: limit,
    });

    let updated = 0;
    let errors = 0;

    for (const article of articles) {
      try {
        const newScore = await scoreImportance(
          article.originalTitle,
          article.originalContent || '',
          model,
        );
        await prisma.article.update({
          where: { id: article.id },
          data: { importanceScore: newScore },
        });
        updated++;
      } catch {
        errors++;
      }
    }

    const remaining = rescoreAll
      ? 0
      : await prisma.article.count({ where: { importanceScore: 5 } });

    return NextResponse.json({
      success: true,
      total: articles.length,
      updated,
      errors,
      model,
      remaining,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
