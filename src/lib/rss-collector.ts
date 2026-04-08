import Parser from 'rss-parser';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from './prisma';
import { RSS_SOURCES, RssSource } from './rss-sources';

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'ai-news-kr/1.0 RSS Collector',
  },
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
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

async function scoreImportance(title: string, snippet: string): Promise<number> {
  try {
    const prompt = `You are evaluating AI news articles for their importance to software developers and engineers.

Article title: ${title}
Summary: ${snippet || '(no summary available)'}

Rate the importance of this article on a scale from 1 to 10 for developers/engineers who want to stay up-to-date with AI.

Scoring guide:
- 10: Major breakthrough, new model release (GPT-5, Claude 4, Gemini 2, etc.), new architecture (Transformer variant, SSM, MoE), critical industry change
- 8-9: New open-source model, significant product launch, important AI framework/library, major API update, new dev tool
- 5-7: Interesting research finding, useful technique, relevant AI trend, performance benchmark
- 3-4: Company news, partnership announcements, opinion pieces with technical insight
- 1-2: Minor update, pure business news, low-technical-relevance content

Priority boost for: new product/architecture releases, open-source releases, practical developer tools, novel techniques.
Downgrade for: opinion only, business-only news, repetitive coverage.

Respond with ONLY a single integer from 1 to 10. No explanation.`;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '5';
    const score = parseInt(text, 10);
    return isNaN(score) || score < 1 || score > 10 ? 5 : score;
  } catch {
    return 5; // default score on error
  }
}

async function collectFromSource(source: RssSource): Promise<{ collected: number; errors: string[] }> {
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
      const publishedAt = item.isoDate ? new Date(item.isoDate) : (item.pubDate ? new Date(item.pubDate) : new Date());

      const importanceScore = await scoreImportance(title, snippet);

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
  const allErrors: string[] = [];
  let totalCollected = 0;

  for (const source of RSS_SOURCES) {
    const { collected, errors } = await collectFromSource(source);
    totalCollected += collected;
    allErrors.push(...errors);
  }

  // record collection log
  await prisma.collectionLog.create({
    data: {
      sourcesChecked: RSS_SOURCES.length,
      articlesCollected: totalCollected,
      articlesTranslated: 0,
      status: allErrors.length === 0 ? 'success' : allErrors.length < RSS_SOURCES.length ? 'partial' : 'failed',
      errorMessage: allErrors.length > 0 ? allErrors.join('\n') : null,
    },
  });

  return {
    sourcesChecked: RSS_SOURCES.length,
    articlesCollected: totalCollected,
    errors: allErrors,
  };
}
