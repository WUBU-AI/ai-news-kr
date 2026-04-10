import {
  selectTranslationTargets,
  resolveSourceType,
  isSimilarTopic,
} from '@/lib/article-selector';
import type { ArticleCandidate } from '@/lib/article-selector';

// ---------------------------------------------------------------------------
// 헬퍼
// ---------------------------------------------------------------------------

const now = Date.now();
const hoursAgo = (h: number): Date => new Date(now - h * 3_600_000);

function makeArticle(
  overrides: Partial<ArticleCandidate> & { originalTitle: string },
): ArticleCandidate {
  return {
    id: overrides.originalTitle,
    sourceName: 'The Verge AI',    // default: RSS/tech
    importanceScore: 50,
    publishedAt: hoursAgo(1),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// resolveSourceType
// ---------------------------------------------------------------------------

describe('resolveSourceType', () => {
  it('tech 카테고리 소스는 rss를 반환한다', () => {
    expect(resolveSourceType('The Verge AI')).toBe('rss');
    expect(resolveSourceType('TechCrunch AI')).toBe('rss');
  });

  it('research 카테고리 소스는 rss를 반환한다', () => {
    expect(resolveSourceType('HuggingFace Blog')).toBe('rss');
    expect(resolveSourceType('MIT Technology Review')).toBe('rss');
  });

  it('newsletter 카테고리 소스는 rss를 반환한다', () => {
    expect(resolveSourceType('Latent Space')).toBe('rss');
  });

  it('company 카테고리 소스는 overseas를 반환한다', () => {
    expect(resolveSourceType('Google DeepMind Blog')).toBe('overseas');
    expect(resolveSourceType('Anthropic News')).toBe('overseas');
  });

  it('korean-ai 카테고리 소스는 domestic을 반환한다', () => {
    expect(resolveSourceType('네이버 D2 Blog')).toBe('domestic');
    expect(resolveSourceType('카카오테크 Blog')).toBe('domestic');
  });

  it('미등록 소스는 rss를 반환한다', () => {
    expect(resolveSourceType('알 수 없는 소스')).toBe('rss');
    expect(resolveSourceType('')).toBe('rss');
  });
});

// ---------------------------------------------------------------------------
// isSimilarTopic
// ---------------------------------------------------------------------------

describe('isSimilarTopic', () => {
  it('동일 제목은 유사로 판단한다', () => {
    // 4자 이상 토큰이 존재하는 영문 제목 사용 (extractKeyTokens는 4자 이상만 추출)
    expect(isSimilarTopic('Claude Sonnet Model Release', 'Claude Sonnet Model Release')).toBe(true);
  });

  it('완전히 다른 제목은 유사하지 않다', () => {
    expect(isSimilarTopic('Claude 3.5 업데이트', 'NVIDIA GPU 출시')).toBe(false);
  });

  it('공통 토큰 비율이 threshold 이상이면 유사로 판단한다', () => {
    // 'openai chatgpt release' vs 'openai chatgpt launch release' — 공통 토큰이 많음
    expect(
      isSimilarTopic(
        'OpenAI ChatGPT Release Update',
        'OpenAI ChatGPT Release Launch',
        0.5,
      ),
    ).toBe(true);
  });

  it('토큰이 없는(짧은) 제목은 유사하지 않다', () => {
    expect(isSimilarTopic('AI', 'AI')).toBe(false);
  });

  it('threshold를 높이면 중복 감지가 줄어든다', () => {
    // 4자 이상 토큰이 존재하는 영문 제목 사용
    const a = 'OpenAI ChatGPT Release Update';
    const b = 'OpenAI ChatGPT Release';
    // 낮은 threshold: 조금만 겹쳐도 중복 감지
    expect(isSimilarTopic(a, b, 0.3)).toBe(true);
    // 매우 높은 threshold: 거의 동일해야만 중복 감지 (b는 a의 부분집합이므로 Jaccard < 1.0)
    expect(isSimilarTopic(a, b, 0.95)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// selectTranslationTargets — 1차: 12시간 이내 필터
// ---------------------------------------------------------------------------

describe('selectTranslationTargets — 1차: 12시간 이내 필터', () => {
  it('12시간 이내 기사만 후보군에 포함된다', () => {
    const articles = [
      makeArticle({ originalTitle: '최신 기사', publishedAt: hoursAgo(3) }),
      makeArticle({ originalTitle: '오래된 기사', publishedAt: hoursAgo(15) }),
    ];
    const result = selectTranslationTargets(articles);
    expect(result).toHaveLength(1);
    expect(result[0].originalTitle).toBe('최신 기사');
  });

  it('publishedAt이 null인 기사는 12시간 필터에서 제외된다', () => {
    const articles = [
      makeArticle({ originalTitle: '날짜 없음', publishedAt: null }),
      makeArticle({ originalTitle: '날짜 있음', publishedAt: hoursAgo(1) }),
    ];
    const result = selectTranslationTargets(articles);
    expect(result).toHaveLength(1);
    expect(result[0].originalTitle).toBe('날짜 있음');
  });

  it('정확히 12시간 이내 기사는 포함된다', () => {
    const articles = [
      makeArticle({ originalTitle: '경계 기사', publishedAt: hoursAgo(11.9) }),
    ];
    const result = selectTranslationTargets(articles);
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 2차: score 내림차순 정렬
// ---------------------------------------------------------------------------

describe('selectTranslationTargets — 2차: 중요도 내림차순 정렬', () => {
  it('12시간 내 기사들은 importanceScore 높은 순으로 정렬된다', () => {
    const articles = [
      makeArticle({ originalTitle: '저스코어', importanceScore: 30, publishedAt: hoursAgo(1) }),
      makeArticle({ originalTitle: '고스코어', importanceScore: 90, publishedAt: hoursAgo(2) }),
      makeArticle({ originalTitle: '중스코어', importanceScore: 60, publishedAt: hoursAgo(3) }),
    ];
    const result = selectTranslationTargets(articles);
    expect(result[0].originalTitle).toBe('고스코어');
    expect(result[1].originalTitle).toBe('중스코어');
    expect(result[2].originalTitle).toBe('저스코어');
  });
});

// ---------------------------------------------------------------------------
// 3차: 중복 주제 제거
// ---------------------------------------------------------------------------

describe('selectTranslationTargets — 3차: 중복 주제 제거', () => {
  it('유사 주제 기사는 고스코어만 남긴다', () => {
    const articles = [
      makeArticle({
        originalTitle: 'OpenAI GPT-5 Model Release Update',
        importanceScore: 80,
        publishedAt: hoursAgo(1),
      }),
      makeArticle({
        originalTitle: 'OpenAI GPT-5 Model Release Launch',
        importanceScore: 70,
        publishedAt: hoursAgo(2),
      }),
      makeArticle({
        originalTitle: 'Google Gemini Ultra Benchmark',
        importanceScore: 60,
        publishedAt: hoursAgo(1),
      }),
    ];
    const result = selectTranslationTargets(articles, 10, 0.4);
    const titles = result.map((a) => a.originalTitle);
    expect(titles).toContain('OpenAI GPT-5 Model Release Update');
    expect(titles).not.toContain('OpenAI GPT-5 Model Release Launch');
    expect(titles).toContain('Google Gemini Ultra Benchmark');
  });

  it('완전히 다른 제목은 중복 제거되지 않는다', () => {
    const articles = [
      makeArticle({ originalTitle: 'Claude Sonnet Model Released', publishedAt: hoursAgo(1) }),
      makeArticle({ originalTitle: 'NVIDIA GPU H200 Launch', publishedAt: hoursAgo(1) }),
      makeArticle({ originalTitle: 'Meta Llama Open Source Update', publishedAt: hoursAgo(1) }),
    ];
    const result = selectTranslationTargets(articles);
    expect(result).toHaveLength(3);
  });

  it('similarityThreshold를 높이면 중복 제거가 덜 된다', () => {
    const articles = [
      makeArticle({ originalTitle: 'OpenAI GPT-5 Model Release', importanceScore: 80, publishedAt: hoursAgo(1) }),
      makeArticle({ originalTitle: 'OpenAI GPT-5 Model Release Update', importanceScore: 70, publishedAt: hoursAgo(1) }),
    ];
    const highThreshold = selectTranslationTargets(articles, 10, 0.95);
    expect(highThreshold).toHaveLength(2);

    const lowThreshold = selectTranslationTargets(articles, 10, 0.3);
    expect(lowThreshold).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 4차: sourceType 순서 정렬 (RSS → 해외기업 → 국내기업)
// ---------------------------------------------------------------------------

describe('selectTranslationTargets — 4차: sourceType 순서 정렬', () => {
  it('RSS → 해외기업 → 국내기업 순으로 정렬된다', () => {
    const articles = [
      makeArticle({ originalTitle: '국내 기사', sourceName: '네이버 D2 Blog', importanceScore: 90, publishedAt: hoursAgo(1) }),
      makeArticle({ originalTitle: '해외기업 기사', sourceName: 'Anthropic News', importanceScore: 80, publishedAt: hoursAgo(1) }),
      makeArticle({ originalTitle: 'RSS 기사', sourceName: 'The Verge AI', importanceScore: 70, publishedAt: hoursAgo(1) }),
    ];
    const result = selectTranslationTargets(articles);
    expect(result[0].originalTitle).toBe('RSS 기사');
    expect(result[1].originalTitle).toBe('해외기업 기사');
    expect(result[2].originalTitle).toBe('국내 기사');
  });

  it('같은 sourceType 내에서는 importanceScore 내림차순을 유지한다', () => {
    const articles = [
      makeArticle({ originalTitle: 'RSS 저스코어', sourceName: 'TechCrunch AI', importanceScore: 50, publishedAt: hoursAgo(1) }),
      makeArticle({ originalTitle: 'RSS 고스코어', sourceName: 'The Verge AI', importanceScore: 80, publishedAt: hoursAgo(1) }),
      makeArticle({ originalTitle: '해외기업 기사', sourceName: 'Google DeepMind Blog', importanceScore: 90, publishedAt: hoursAgo(1) }),
    ];
    const result = selectTranslationTargets(articles);
    expect(result[0].originalTitle).toBe('RSS 고스코어');
    expect(result[1].originalTitle).toBe('RSS 저스코어');
    expect(result[2].originalTitle).toBe('해외기업 기사');
  });
});

// ---------------------------------------------------------------------------
// 5차: 폴백 (12시간 내 기사 없을 때)
// ---------------------------------------------------------------------------

describe('selectTranslationTargets — 5차: 폴백', () => {
  it('12시간 내 기사가 없으면 전체 최근 20개 중 score순으로 폴백한다', () => {
    const articles = [
      makeArticle({ originalTitle: '오래된 저스코어', importanceScore: 30, publishedAt: hoursAgo(14) }),
      makeArticle({ originalTitle: '오래된 고스코어', importanceScore: 90, publishedAt: hoursAgo(13) }),
      makeArticle({ originalTitle: '오래된 중스코어', importanceScore: 60, publishedAt: hoursAgo(13) }),
    ];
    const result = selectTranslationTargets(articles);
    expect(result.length).toBeGreaterThan(0);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].importanceScore).toBeGreaterThanOrEqual(result[i].importanceScore);
    }
  });

  it('폴백 시 최근 20개로 제한된다', () => {
    const articles = Array.from({ length: 30 }, (_, i) =>
      makeArticle({ originalTitle: `오래된 기사 ${i}`, importanceScore: i, publishedAt: hoursAgo(20 + i) }),
    );
    const result = selectTranslationTargets(articles, 30);
    expect(result.length).toBeLessThanOrEqual(20);
  });

  it('articles가 완전히 비어있으면 빈 배열을 반환한다 (폴백 미실행)', () => {
    const result = selectTranslationTargets([]);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// maxCount 제한
// ---------------------------------------------------------------------------

describe('selectTranslationTargets — maxCount', () => {
  it('maxCount로 결과 수를 제한한다', () => {
    const articles = Array.from({ length: 10 }, (_, i) =>
      makeArticle({ originalTitle: `기사 ${i}`, importanceScore: 50 + i, publishedAt: hoursAgo(1) }),
    );
    const result = selectTranslationTargets(articles, 3);
    expect(result).toHaveLength(3);
  });

  it('기사 수가 maxCount보다 적으면 전체 반환한다', () => {
    const articles = [
      makeArticle({ originalTitle: '기사 A', publishedAt: hoursAgo(1) }),
      makeArticle({ originalTitle: '기사 B', publishedAt: hoursAgo(2) }),
    ];
    const result = selectTranslationTargets(articles, 10);
    expect(result).toHaveLength(2);
  });
});
