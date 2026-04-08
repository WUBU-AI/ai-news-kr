import { NextResponse } from 'next/server';
import { collectAllFeeds } from '@/lib/rss-collector';

function isAuthorized(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  // Also allow requests from Vercel Cron (no auth in dev)
  if (process.env.NODE_ENV === 'development') return true;
  return false;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await collectAllFeeds();
    return NextResponse.json({
      success: true,
      sourcesChecked: result.sourcesChecked,
      articlesCollected: result.articlesCollected,
      errors: result.errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// Also support GET for Vercel Cron compatibility
export async function GET(request: Request) {
  return POST(request);
}
