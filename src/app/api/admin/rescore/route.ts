import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { scoreImportance, getScoreModel } from '@/lib/scorer';

// POST /api/admin/rescore
// Re-scores articles whose importanceScore is exactly 5.
// Pass ?all=true to re-score every article regardless of current score.
// Uses the local CLI model configured in settings (translate_model, default: claude_cli).

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const rescoreAll = searchParams.get('all') === 'true';

  const model = await getScoreModel();

  try {
    const articles = await prisma.article.findMany({
      where: rescoreAll ? undefined : { importanceScore: 5 },
      select: { id: true, originalTitle: true, originalContent: true },
      orderBy: { collectedAt: 'desc' },
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

    return NextResponse.json({
      success: true,
      total: articles.length,
      updated,
      errors,
      model,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
