import Parser from 'rss-parser';
import { prisma } from './prisma';
import { RSS_SOURCES, RssSource } from './rss-sources';
import { scoreImportance, getScoreModel } from './scorer';

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'ai-news-kr/1.0 RSS Collector',
  },
});

export interface CollectionResult {
  sourcesChecked: number;
  articlesCollected: number;
  errors: string[];
}

interface FeedItem {
  title?: string;
  link?: string;
  contentSnippet?: string;
  content?: string;
  pubDate?: string;
  isoDate?: string;
}

async function collectFromSource(
  source: RssSource,
  model: Awaited<ReturnType<typeof getScoreModel>>,
): Promise<{ collected: number; errors: string[] }> {
  const errors: string[] = [];
  let collected = 0;

  try {
    const feed = await parser.parseURL(source.url);
    const items: FeedItem[] = feed.items || [];

    for (const item of items.slice(0, 20)) {
      const url = item.link;
      if (!url) continue;

      // duplicate check
      const existing = await prisma.article.findUnique({
        where: { sourceUrl: url },
        select: { id: true },
      });
      if (existing) continue;

      const title = item.title || 'Untitled';
      const snippet = item.contentSnippet || item.content?.slice(0, 500) || '';
      const publishedAt = item.isoDate
        ? new Date(item.isoDate)
        : item.pubDate
          ? new Date(item.pubDate)
          : new Date();

      let importanceScore = 5;
      try {
        importanceScore = await scoreImportance(title, snippet, model);
      } catch {
        // keep default score on error
      }

      await prisma.article.create({
        data: {
          sourceUrl: url,
          sourceName: source.name,
          originalTitle: title,
          originalContent: snippet || null,
          importanceScore,
          category: source.category || null,
          publishedAt: isNaN(publishedAt.getTime()) ? new Date() : publishedAt,
        },
      });

      collected++;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`[${source.name}] ${msg}`);
  }

  return { collected, errors };
}

export async function collectAllFeeds(): Promise<CollectionResult> {
  const model = await getScoreModel();
  const allErrors: string[] = [];
  let totalCollected = 0;

  for (const source of RSS_SOURCES) {
    const { collected, errors } = await collectFromSource(source, model);
    totalCollected += collected;
    allErrors.push(...errors);
  }

  // record collection log
  await prisma.collectionLog.create({
    data: {
      sourcesChecked: RSS_SOURCES.length,
      articlesCollected: totalCollected,
      articlesTranslated: 0,
      status:
        allErrors.length === 0
          ? 'success'
          : allErrors.length < RSS_SOURCES.length
            ? 'partial'
            : 'failed',
      errorMessage: allErrors.length > 0 ? allErrors.join('\n') : null,
    },
  });

  return {
    sourcesChecked: RSS_SOURCES.length,
    articlesCollected: totalCollected,
    errors: allErrors,
  };
}
