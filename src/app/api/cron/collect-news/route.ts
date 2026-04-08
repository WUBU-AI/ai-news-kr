import { NextResponse } from 'next/server';
import { collectAllFeeds } from '@/lib/rss-collector';
import { translateTopArticles } from '@/lib/translator';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Step 1: Collect from RSS feeds (includes importance scoring)
    const collectResult = await collectAllFeeds();

    // Step 2: Translate and summarize top N articles
    const translateResult = await translateTopArticles();

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
