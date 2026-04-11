import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import AdUnit from '@/components/AdUnit';
import FilterBar from '@/components/FilterBar';
import { Suspense } from 'react';
import type { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://ai-news-kr.vercel.app';

const PAGE_SIZE = 20;

interface PageProps {
  searchParams: Promise<{ page?: string; category?: string | string[]; tag?: string | string[]; source?: string | string[]; sort?: string }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params?.page || '1', 10));
  return {
    alternates: {
      canonical: BASE_URL,
    },
    // Paginated pages beyond the first are noindex to avoid duplicate content
    ...(page > 1 && { robots: { index: false, follow: true } }),
  };
}

function importanceColor(score: number): string {
  if (score >= 8) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
  if (score <= 3) return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-gray-700';
  return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
}

function importanceDot(score: number): string {
  if (score >= 8) return 'bg-red-500';
  if (score <= 3) return 'bg-blue-500';
  return 'bg-gray-400';
}

function categoryColor(cat: string | null): string {
  const map: Record<string, string> = {
    'LLM': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    '이미지AI': 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
    '로봇': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    '자율주행': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
    '업계동향': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    '연구': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    '기타': 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };
  return map[cat ?? ''] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
}

function formatKST(date: Date | null): string {
  if (!date) return '알 수 없음';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

function timeAgo(date: Date | null): string {
  if (!date) return '';
  const diff = Date.now() - new Date(date).getTime();
  const hours = Math.floor(diff / 1000 / 60 / 60);
  if (hours < 1) return '방금 전';
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return formatKST(date);
}

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params?.page || '1', 10));
  const sort = params?.sort === 'score' ? 'score' : 'date';

  // Support multi-value: category=LLM&category=로봇 → ['LLM', '로봇']
  const rawCategories = params?.category;
  const rawTags = params?.tag;
  const rawSources = params?.source;
  const categories = rawCategories
    ? Array.isArray(rawCategories) ? rawCategories : [rawCategories]
    : [];
  const tags = rawTags
    ? Array.isArray(rawTags) ? rawTags : [rawTags]
    : [];
  const sources = rawSources
    ? Array.isArray(rawSources) ? rawSources : [rawSources]
    : [];

  const skip = (page - 1) * PAGE_SIZE;

  // Build OR conditions for multi-select filters
  const categoryFilter = categories.length > 0 ? { category: { in: categories } } : {};
  const tagFilter = tags.length > 0
    ? { OR: tags.map((t) => ({ tags: { has: t } })) }
    : {};
  const sourceFilter = sources.length > 0 ? { sourceName: { in: sources } } : {};

  const translatedWhere = {
    translatedTitle: { not: null },
    ...categoryFilter,
    ...tagFilter,
    ...sourceFilter,
  };

  let articles: Awaited<ReturnType<typeof prisma.article.findMany>> = [];
  let total = 0;
  let lastCollected: Date | null = null;
  let dbError = false;
  let adsensePublisherId = '';
  let popularTags: string[] = [];
  let availableSources: string[] = [];
  let untranslatedArticles: { id: string; originalTitle: string; importanceScore: number; sourceUrl: string; sourceName: string; publishedAt: Date | null }[] = [];

  try {
    const [articleData, countData, lastLog, adSetting, tagRows, sourceRows, untranslatedData] = await Promise.all([
      prisma.article.findMany({
        where: translatedWhere,
        orderBy: sort === 'score'
          ? [{ importanceScore: 'desc' }, { publishedAt: 'desc' }]
          : [{ publishedAt: 'desc' }],
        skip,
        take: PAGE_SIZE,
      }),
      prisma.article.count({ where: translatedWhere }),
      prisma.collectionLog.findFirst({
        orderBy: { runAt: 'desc' },
        select: { runAt: true },
      }),
      prisma.setting.findUnique({ where: { key: 'adsense_publisher_id' } }),
      // Collect popular tags from recent articles
      prisma.article.findMany({
        where: { translatedTitle: { not: null } },
        select: { tags: true },
        take: 100,
        orderBy: { publishedAt: 'desc' },
      }),
      // Collect distinct source names from recent translated articles
      prisma.article.findMany({
        where: { translatedTitle: { not: null } },
        select: { sourceName: true },
        distinct: ['sourceName'],
        orderBy: { publishedAt: 'desc' },
      }),
      // Untranslated articles (score below threshold — not translated yet)
      categories.length === 0 && tags.length === 0 && sources.length === 0
        ? prisma.article.findMany({
            where: { translatedTitle: null },
            orderBy: [{ importanceScore: 'desc' }, { publishedAt: 'desc' }],
            take: 30,
            select: {
              id: true,
              originalTitle: true,
              importanceScore: true,
              sourceUrl: true,
              sourceName: true,
              publishedAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

    articles = articleData;
    total = countData;
    lastCollected = lastLog?.runAt ?? null;
    adsensePublisherId = adSetting?.value || '';
    untranslatedArticles = untranslatedData as typeof untranslatedArticles;

    // Tally tag frequencies
    const tagCount: Record<string, number> = {};
    for (const row of tagRows) {
      for (const t of row.tags) {
        tagCount[t] = (tagCount[t] || 0) + 1;
      }
    }
    popularTags = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([t]) => t);

    availableSources = sourceRows.map((r) => r.sourceName).sort();
  } catch {
    dbError = true;
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'AI 뉴스 KR',
    url: BASE_URL,
    description: '영어 AI 뉴스를 한국어로 번역·요약해 제공합니다. LLM, 이미지AI, 로봇, 자율주행 등 최신 AI 동향을 빠르게 파악하세요.',
    inLanguage: 'ko',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/?tag={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <div>
      {/* WebSite structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">오늘의 AI 뉴스</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          AI 관련 최신 뉴스를 한국어로 번역·요약해 제공합니다.
        </p>
        {lastCollected && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            마지막 수집: {formatKST(lastCollected)}
          </p>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> 중요도 높음 (8–10)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" /> 중간 (4–7)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> 낮음 (1–3)
        </span>
      </div>

      {/* Filter Bar */}
      <Suspense>
        <FilterBar availableTags={popularTags} availableSources={availableSources} currentSort={sort} />
      </Suspense>

      {/* DB Error */}
      {dbError && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6 text-center">
          <p className="text-red-600 dark:text-red-400 font-medium mb-1">데이터베이스 연결 오류</p>
          <p className="text-sm text-red-500 dark:text-red-400/70">
            DATABASE_URL 환경 변수를 확인해 주세요.
          </p>
        </div>
      )}

      {/* Empty State */}
      {!dbError && articles.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-12 text-center">
          <div className="text-4xl mb-3">📰</div>
          <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">
            {categories.length > 0 || tags.length > 0 || sources.length > 0 ? '해당 필터에 맞는 기사가 없습니다' : '아직 수집된 기사가 없습니다'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {categories.length > 0 || tags.length > 0 || sources.length > 0 ? '다른 카테고리, 태그, 또는 출처를 선택해 보세요.' : '뉴스는 3시간마다 자동으로 수집됩니다.'}
          </p>
        </div>
      )}

      {/* Article List */}
      {articles.length > 0 && (
        <div className="space-y-4">
          {articles.map((article, index) => (
            <>
              {/* Ad after every 5th article */}
              {index > 0 && index % 5 === 0 && adsensePublisherId && (
                <AdUnit key={`ad-${index}`} publisherId={adsensePublisherId} format="auto" className="my-2" />
              )}
              <Link
                key={article.id}
                href={`/articles/${article.id}`}
                className="block rounded-lg border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors p-4 group"
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    {article.category && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${categoryColor(article.category)}`}>
                        {article.category}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                      {article.sourceName}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                      {timeAgo(article.publishedAt)}
                    </span>
                  </div>
                  {/* Importance badge */}
                  <span className={`shrink-0 text-xs font-mono px-2 py-0.5 rounded border font-semibold ${importanceColor(article.importanceScore)}`}>
                    <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${importanceDot(article.importanceScore)}`} />
                    {article.importanceScore.toFixed(1)}
                  </span>
                </div>

                {/* Title */}
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug mb-2">
                  {article.translatedTitle || article.originalTitle}
                </h2>

                {/* Bullet preview */}
                {article.summaryBullets.length > 0 && (
                  <ul className="space-y-0.5 mb-2">
                    {article.summaryBullets.slice(0, 2).map((bullet, i) => (
                      <li key={i} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-1.5">
                        <span className="text-gray-400 mt-0.5 shrink-0">•</span>
                        <span className="line-clamp-1">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Tags */}
                {article.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {article.tags.slice(0, 4).map((t) => (
                      <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            </>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          {page > 1 && (
            <Link
              href={`/?${new URLSearchParams([['page', String(page - 1)], ...(sort === 'score' ? [['sort', 'score']] as [string, string][] : []), ...categories.map((c) => ['category', c] as [string, string]), ...tags.map((t) => ['tag', t] as [string, string]), ...sources.map((s) => ['source', s] as [string, string])]).toString()}`}
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              ← 이전
            </Link>
          )}
          <span className="text-sm text-gray-500 dark:text-gray-400 px-2">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/?${new URLSearchParams([['page', String(page + 1)], ...(sort === 'score' ? [['sort', 'score']] as [string, string][] : []), ...categories.map((c) => ['category', c] as [string, string]), ...tags.map((t) => ['tag', t] as [string, string]), ...sources.map((s) => ['source', s] as [string, string])]).toString()}`}
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              다음 →
            </Link>
          )}
        </div>
      )}

      {/* Untranslated articles section */}
      {categories.length === 0 && tags.length === 0 && untranslatedArticles.length > 0 && (
        <section className="mt-12">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300">
              번역 대기 중인 기사
            </h2>
            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
              {untranslatedArticles.length}건
            </span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
            중요도 기준으로 번역 우선순위에서 제외된 기사입니다. 원문 링크로 직접 확인할 수 있습니다.
          </p>
          <div className="space-y-1.5">
            {untranslatedArticles.map((article) => (
              <div
                key={article.id}
                className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800/50 bg-gray-50 dark:bg-gray-900/50"
              >
                <span className={`shrink-0 text-xs font-mono px-1.5 py-0.5 rounded border font-semibold ${importanceColor(article.importanceScore)}`}>
                  <span className={`inline-block w-1 h-1 rounded-full mr-0.5 ${importanceDot(article.importanceScore)}`} />
                  {article.importanceScore.toFixed(1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{article.originalTitle}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{article.sourceName} · {timeAgo(article.publishedAt)}</p>
                </div>
                <a
                  href={article.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 hover:underline"
                >
                  원문 →
                </a>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
