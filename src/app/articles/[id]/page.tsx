import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import AdUnit from '@/components/AdUnit';
import CoupangBanner from '@/components/CoupangBanner';

function importanceColor(score: number): string {
  if (score >= 8) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
  if (score <= 3) return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
  return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
}

function importanceDot(score: number): string {
  if (score >= 8) return 'bg-red-500';
  if (score <= 3) return 'bg-blue-500';
  return 'bg-gray-400';
}

function importanceLabel(score: number): string {
  if (score >= 8) return '중요도 높음';
  if (score <= 3) return '중요도 낮음';
  return '중요도 보통';
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
    month: 'long',
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

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://ai-news-kr.vercel.app';

interface PageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const article = await prisma.article.findUnique({
      where: { id: params.id },
      select: {
        translatedTitle: true,
        originalTitle: true,
        summaryBullets: true,
        tags: true,
        category: true,
        publishedAt: true,
      },
    });
    if (!article) return {};
    const title = article.translatedTitle || article.originalTitle;
    const desc = article.summaryBullets[0] ?? '';
    const pageUrl = `${BASE_URL}/articles/${params.id}`;
    return {
      title: `${title} | AI 뉴스 한국어`,
      description: desc,
      keywords: article.tags,
      openGraph: {
        title: `${title} | AI 뉴스 한국어`,
        description: desc,
        url: pageUrl,
        type: 'article',
        locale: 'ko_KR',
        publishedTime: article.publishedAt?.toISOString(),
        section: article.category ?? undefined,
        tags: article.tags,
        siteName: 'AI 뉴스 KR',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${title} | AI 뉴스 한국어`,
        description: desc,
      },
      alternates: {
        canonical: pageUrl,
      },
    };
  } catch {
    return {};
  }
}

type RelatedArticle = {
  id: string;
  translatedTitle: string | null;
  originalTitle: string;
  importanceScore: number;
  category: string | null;
  sourceName: string;
  publishedAt: Date | null;
  summaryBullets: string[];
};

export default async function ArticlePage({ params }: PageProps) {
  let article: Awaited<ReturnType<typeof prisma.article.findUnique>> = null;
  let related: RelatedArticle[] = [];
  let adsensePublisherId = '';
  let coupangTrackingId = '';

  try {
    const [articleData, adSetting, coupangSetting] = await Promise.all([
      prisma.article.findUnique({ where: { id: params.id } }),
      prisma.setting.findUnique({ where: { key: 'adsense_publisher_id' } }),
      prisma.setting.findUnique({ where: { key: 'coupang_tracking_id' } }),
    ]);
    article = articleData;
    adsensePublisherId = adSetting?.value || '';
    coupangTrackingId = coupangSetting?.value || '';

    if (!article) notFound();

    // Increment view count
    await prisma.article.update({
      where: { id: params.id },
      data: { viewCount: { increment: 1 } },
    });

    related = await prisma.article.findMany({
      where: {
        category: article!.category ?? undefined,
        id: { not: params.id },
        translatedTitle: { not: null },
      },
      orderBy: { publishedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        translatedTitle: true,
        originalTitle: true,
        importanceScore: true,
        category: true,
        sourceName: true,
        publishedAt: true,
        summaryBullets: true,
      },
    });
  } catch {
    if (!article) {
      return (
        <div className="text-center py-20">
          <p className="text-red-500">데이터베이스 연결 오류가 발생했습니다.</p>
          <Link href="/" className="text-blue-500 hover:underline mt-2 inline-block">← 홈으로</Link>
        </div>
      );
    }
  }

  if (!article) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.translatedTitle || article.originalTitle,
    description: article.summaryBullets[0] ?? '',
    url: `${BASE_URL}/articles/${params.id}`,
    datePublished: article.publishedAt?.toISOString(),
    dateModified: article.publishedAt?.toISOString(),
    publisher: {
      '@type': 'Organization',
      name: 'AI 뉴스 KR',
      url: BASE_URL,
    },
    keywords: article.tags.join(', '),
    articleSection: article.category ?? undefined,
    inLanguage: 'ko',
  };

  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Back link */}
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-5 transition-colors">
        ← 목록으로
      </Link>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {article.category && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColor(article.category)}`}>
            {article.category}
          </span>
        )}
        <span className={`text-xs px-2 py-0.5 rounded border font-semibold font-mono ${importanceColor(article.importanceScore)}`}>
          <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${importanceDot(article.importanceScore)}`} />
          {importanceLabel(article.importanceScore)} {article.importanceScore.toFixed(1)}
        </span>
      </div>

      {/* Title */}
      <h1 className="text-2xl sm:text-3xl font-bold leading-snug mb-2 text-gray-900 dark:text-gray-50">
        {article.translatedTitle || article.originalTitle}
      </h1>

      {/* Original title */}
      {article.translatedTitle && (
        <p className="text-sm text-gray-400 dark:text-gray-500 mb-4 italic">
          {article.originalTitle}
        </p>
      )}

      {/* Source info */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mb-6 pb-6 border-b border-gray-200 dark:border-gray-800">
        <span className="font-medium text-gray-700 dark:text-gray-300">{article.sourceName}</span>
        <span>·</span>
        <time dateTime={article.publishedAt?.toISOString()}>
          {formatKST(article.publishedAt)}
        </time>
        {article.viewCount > 0 && (
          <>
            <span>·</span>
            <span>{article.viewCount.toLocaleString()}회 조회</span>
          </>
        )}
      </div>

      {/* Summary Bullets */}
      {article.summaryBullets.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            핵심 요약
          </h2>
          <ul className="space-y-2.5">
            {article.summaryBullets.map((bullet, i) => (
              <li key={i} className="flex items-start gap-2.5 text-gray-800 dark:text-gray-200">
                <span className="text-blue-500 dark:text-blue-400 font-bold mt-0.5 shrink-0">▸</span>
                <span className="leading-relaxed">{bullet}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Tags */}
      {article.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {article.tags.map((tag) => (
            <span key={tag} className="text-xs px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Original link button */}
      <a
        href={article.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium text-sm hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors"
      >
        원문 보기 →
      </a>

      {/* Ad + 쿠팡 배너 */}
      {adsensePublisherId && (
        <AdUnit publisherId={adsensePublisherId} format="auto" className="mt-8" />
      )}
      {coupangTrackingId && (
        <CoupangBanner trackingId={coupangTrackingId} className="mt-4" />
      )}

      {/* Related Articles */}
      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">
            관련 기사
          </h2>
          <div className="space-y-3">
            {related.map((rel) => (
              <Link
                key={rel.id}
                href={`/articles/${rel.id}`}
                className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
              >
                <span className={`shrink-0 text-xs font-mono px-1.5 py-0.5 rounded border font-semibold mt-0.5 ${importanceColor(rel.importanceScore)}`}>
                  {rel.importanceScore.toFixed(0)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                    {rel.translatedTitle || rel.originalTitle}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {rel.sourceName} · {timeAgo(rel.publishedAt)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
