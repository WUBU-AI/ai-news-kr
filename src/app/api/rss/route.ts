import { prisma } from '@/lib/prisma';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://ai-news-kr.vercel.app';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toRfc822(date: Date | null): string {
  if (!date) return new Date().toUTCString();
  return date.toUTCString();
}

export async function GET() {
  try {
    const articles = await prisma.article.findMany({
      where: { translatedTitle: { not: null } },
      orderBy: [{ publishedAt: 'desc' }, { collectedAt: 'desc' }],
      take: 50,
      select: {
        id: true,
        translatedTitle: true,
        summaryBullets: true,
        category: true,
        publishedAt: true,
        collectedAt: true,
      },
    });

    const items = articles
      .map((article) => {
        const title = escapeXml(article.translatedTitle ?? '');
        const link = `${BASE_URL}/articles/${article.id}`;
        const description = escapeXml(
          article.summaryBullets.map((b) => `• ${b}`).join('\n')
        );
        const pubDate = toRfc822(article.publishedAt ?? article.collectedAt);
        const guid = link;
        const category = article.category ? `<category>${escapeXml(article.category)}</category>` : '';

        return `    <item>
      <title>${title}</title>
      <link>${link}</link>
      <description>${description}</description>
      <pubDate>${pubDate}</pubDate>
      <guid isPermaLink="true">${guid}</guid>
      ${category}
    </item>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AI 뉴스 KR</title>
    <link>${BASE_URL}</link>
    <description>개발자를 위한 AI 최신 소식 — 한국어 번역·요약</description>
    <language>ko</language>
    <atom:link href="${BASE_URL}/api/rss" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(`<error>${escapeXml(message)}</error>`, {
      status: 500,
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    });
  }
}
