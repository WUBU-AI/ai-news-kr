import { NextResponse } from 'next/server';
import { collectAllFeeds } from '@/lib/rss-collector';
import { translateTopArticles } from '@/lib/translator';
import { prisma } from '@/lib/prisma';

function isAuthorized(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  // Vercel Cron sends the secret in x-vercel-signature or as authorization header
  const vercelCronSecret = request.headers.get('x-vercel-cron-secret');
  if (vercelCronSecret && vercelCronSecret === process.env.CRON_SECRET) return true;
  if (process.env.NODE_ENV === 'development') return true;
  return false;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Step 1: Collect articles from RSS feeds (includes importance scoring)
    const collectResult = await collectAllFeeds();

    // Step 2: Translate and summarize top N articles
    const translateResult = await translateTopArticles();

    // Update the latest collection log with translation count
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
      errors: allErrors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// Vercel Cron uses GET
export async function GET(request: Request) {
  return POST(request);
}
