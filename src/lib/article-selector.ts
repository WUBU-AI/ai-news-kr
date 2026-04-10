/**
 * article-selector.ts
 *
 * 번역/요약 대상 기사를 5단계 필터링으로 선별한다.
 *
 * 1차: 최근 12시간 이내 발행 기사 우선
 * 2차: 중요도(importanceScore) 높은 순 정렬
 * 3차: 중복 주제 제외 (제목 Jaccard 유사도 기반)
 * 4차: RSS → 해외기업 → 국내기업 소스 순서 그루핑
 * 5차: 1차 조건 충족 기사가 없으면 가장 최근 20개 중 중요도순으로 폴백
 */

import { RSS_SOURCES } from './rss-sources';

/** 소스 타입 — 4차 정렬 순서에 사용 */
export type SourceType = 'rss' | 'overseas' | 'domestic';

/** article-selector가 처리하는 기사 형태 (Prisma Article의 서브셋) */
export interface ArticleCandidate {
  id: string;
  sourceName: string;
  originalTitle: string;
  importanceScore: number;
  publishedAt: Date | null;
}

// ---------------------------------------------------------------------------
// 소스 이름 → SourceType 매핑
// RSS_SOURCES의 category를 기반으로 빌드한다.
// ---------------------------------------------------------------------------

const SOURCE_CATEGORY_MAP: Record<string, string> = {};
for (const s of RSS_SOURCES) {
  if (s.category) SOURCE_CATEGORY_MAP[s.name] = s.category;
}

/**
 * sourceName에서 SourceType을 반환한다.
 * - 'korean-ai'  → 'domestic'  (국내 AI 기업)
 * - 'company'    → 'overseas'  (해외 AI 기업)
 * - 그 외 / 미등록 → 'rss'
 */
export function resolveSourceType(sourceName: string): SourceType {
  const category = SOURCE_CATEGORY_MAP[sourceName];
  if (category === 'korean-ai') return 'domestic';
  if (category === 'company') return 'overseas';
  return 'rss';
}

// ---------------------------------------------------------------------------
// sourceType 우선순위 (낮을수록 먼저)
// ---------------------------------------------------------------------------

const SOURCE_TYPE_ORDER: Record<SourceType, number> = {
  rss: 0,
  overseas: 1,
  domestic: 2,
};

// ---------------------------------------------------------------------------
// 중복 주제 감지 (Jaccard 유사도)
// ---------------------------------------------------------------------------

/** 제목에서 의미 있는 키워드 토큰을 추출한다 (4자 이상 단어) */
function extractKeyTokens(title: string): Set<string> {
  return new Set(
    title
      .replace(/[^\uAC00-\uD7A3a-zA-Z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 4)
      .map((t) => t.toLowerCase()),
  );
}

/**
 * 두 기사 제목이 유사한 주제인지 판단한다.
 * 공통 토큰 비율(Jaccard)이 threshold 이상이면 중복으로 간주.
 */
export function isSimilarTopic(
  titleA: string,
  titleB: string,
  threshold = 0.5,
): boolean {
  const tokensA = extractKeyTokens(titleA);
  const tokensB = extractKeyTokens(titleB);
  if (tokensA.size === 0 || tokensB.size === 0) return false;

  let common = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) common++;
  }
  const unionSize = tokensA.size + tokensB.size - common;
  return common / unionSize >= threshold;
}

// ---------------------------------------------------------------------------
// 5단계 필터링 핵심 함수
// ---------------------------------------------------------------------------

/**
 * 5단계 필터링으로 번역/요약 대상 기사를 선별한다.
 *
 * @param articles            전체 미번역 기사 목록 (DB에서 조회한 결과)
 * @param maxCount            선정할 최대 기사 수 (기본 10)
 * @param similarityThreshold 중복 주제 판단 Jaccard 임계값 (기본 0.5)
 */
export function selectTranslationTargets(
  articles: ArticleCandidate[],
  maxCount = 10,
  similarityThreshold = 0.5,
): ArticleCandidate[] {
  const now = Date.now();
  const twelveHoursMs = 12 * 3_600_000;

  // 1차: 최근 12시간 이내 기사 필터
  const recent12h = articles.filter((a) => {
    if (!a.publishedAt) return false;
    return now - new Date(a.publishedAt).getTime() <= twelveHoursMs;
  });

  // 5차 폴백: articles가 존재하지만 12시간 내 기사가 없을 때만 폴백
  //           articles 자체가 빈 배열이면 폴백 없이 빈 배열 반환
  const pool =
    recent12h.length > 0 || articles.length === 0
      ? recent12h
      : [...articles]
          .sort((a, b) => {
            const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
            const db = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
            return db - da;
          })
          .slice(0, 20);

  // 2차: 중요도(importanceScore) 내림차순 정렬
  const sorted = [...pool].sort((a, b) => b.importanceScore - a.importanceScore);

  // 3차: 중복 주제 제거 (이미 선정된 기사와 유사 주제면 스킵)
  const deduped: ArticleCandidate[] = [];
  for (const article of sorted) {
    const isDup = deduped.some((selected) =>
      isSimilarTopic(selected.originalTitle, article.originalTitle, similarityThreshold),
    );
    if (!isDup) deduped.push(article);
  }

  // 4차: sourceType 순서로 그루핑 정렬 (RSS → 해외기업 → 국내기업)
  //     같은 sourceType 내에서는 importanceScore 내림차순 유지
  deduped.sort((a, b) => {
    const typeA = resolveSourceType(a.sourceName);
    const typeB = resolveSourceType(b.sourceName);
    const orderDiff = SOURCE_TYPE_ORDER[typeA] - SOURCE_TYPE_ORDER[typeB];
    if (orderDiff !== 0) return orderDiff;
    return b.importanceScore - a.importanceScore;
  });

  return deduped.slice(0, maxCount);
}
