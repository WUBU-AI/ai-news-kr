import { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://ai-news-kr.vercel.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1.0,
    },
  ];

  try {
    const articles = await prisma.article.findMany({
      where: { translatedTitle: { not: null } },
      select: { id: true, collectedAt: true, publishedAt: true },
      orderBy: { publishedAt: 'desc' },
      take: 1000,
    });

    const articleRoutes: MetadataRoute.Sitemap = articles.map((article) => ({
      url: `${BASE_URL}/articles/${article.id}`,
      lastModified: article.publishedAt ?? article.collectedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

    return [...staticRoutes, ...articleRoutes];
  } catch {
    return staticRoutes;
  }
}
