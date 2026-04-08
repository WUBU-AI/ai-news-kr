import { NextResponse } from 'next/server';
import { collectAllFeeds } from '@/lib/rss-collector';
import { translateTopArticles } from '@/lib/translator';
import { prisma } from '@/lib/prisma';

// Admin-only manual collect trigger.
// Protected by Basic Auth middleware (same as /admin/* routes).
// The internal scheduler uses /api/cron/collect with CRON_SECRET instead.
export async function POST() {
  try {
    const collectResult = await collectAllFeeds();
    const translateResult = await translateTopArticles();

    await prisma.collectionLog.updateMany({
      where: { articlesTranslated: 0 },
      data: { articlesTranslated: translateResult.articlesTranslated },
    });

    const allErrors = [...collectResult.errors, ...translateResult.errors];

    return NextResponse.json({
      success: true,
      sourcesChecked: collectResult.sourcesChecked,
      articlesCollected: collectResult.articlesCollected,
      articlesTranslated: translateResult.articlesTranslated,
      translateModel: translateResult.modelUsed,
      errors: allErrors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
