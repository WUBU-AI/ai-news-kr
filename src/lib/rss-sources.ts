export interface RssSource {
  name: string;
  url: string;
  category?: string;
  /** Language of content: 'en' (default) or 'ko'. Korean articles skip translation, only summarize. */
  lang?: 'en' | 'ko';
  /** If set, fetch this URL via HTML scraping instead of RSS parsing */
  scrapeUrl?: string;
}

export const RSS_SOURCES: RssSource[] = [
  // ── 테크 미디어 ──────────────────────────────────────────────────────────
  {
    name: 'The Verge AI',
    url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', // Atom
    category: 'tech',
  },
  {
    name: 'TechCrunch AI',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    category: 'tech',
  },
  {
    name: 'Ars Technica',
    url: 'https://feeds.arstechnica.com/arstechnica/technology-lab',
    category: 'tech',
  },
  {
    name: 'The Decoder',
    url: 'https://the-decoder.com/feed/',
    category: 'tech',
  },
  {
    name: 'AI Business',
    url: 'https://aibusiness.com/rss.xml',
    category: 'tech',
  },

  // ── AI 리서치 / 학술 ──────────────────────────────────────────────────────
  {
    name: 'MIT Technology Review',
    url: 'https://www.technologyreview.com/feed/',
    category: 'research',
  },
  {
    name: 'HuggingFace Blog',
    url: 'https://huggingface.co/blog/feed.xml',
    category: 'research',
  },
  {
    name: 'IEEE Spectrum AI',
    url: 'https://spectrum.ieee.org/feeds/topic/artificial-intelligence.rss',
    category: 'research',
  },
  {
    name: 'Berkeley AI Research',
    url: 'https://bair.berkeley.edu/blog/feed.xml',
    category: 'research',
  },

  // ── AI 기업 공식 블로그 ───────────────────────────────────────────────────
  {
    name: 'Google DeepMind Blog',
    url: 'https://deepmind.google/blog/rss.xml',
    category: 'company',
  },
  {
    name: 'Google AI Blog',
    url: 'https://blog.google/innovation-and-ai/technology/ai/rss/',
    category: 'company',
  },
  {
    name: 'Microsoft AI Blog',
    url: 'https://blogs.microsoft.com/ai/feed/',
    category: 'company',
  },
  {
    name: 'NVIDIA Blog',
    url: 'https://blogs.nvidia.com/feed/',
    category: 'company',
  },
  {
    name: 'AWS Machine Learning Blog',
    url: 'https://aws.amazon.com/blogs/machine-learning/feed/',
    category: 'company',
  },
  {
    name: 'Roboflow Blog',
    url: 'https://blog.roboflow.com/rss/',
    category: 'company',
  },

  // ── 뉴스레터 / 커뮤니티 ──────────────────────────────────────────────────
  {
    name: 'Latent Space',
    url: 'https://www.latent.space/feed',
    category: 'newsletter',
  },
  {
    name: 'Ahead of AI',
    url: 'https://magazine.sebastianraschka.com/feed',
    category: 'newsletter',
  },
  {
    name: 'AI Weekly',
    url: 'https://aiweekly.co/issues.rss',
    category: 'newsletter',
  },

  // ── 해외 AI 기업 (cheerio 스크래퍼) ─────────────────────────────────────────
  // scrapeUrl 지정 시 RSS 파싱 대신 HTML 스크래핑으로 수집
  {
    name: 'Anthropic News',
    url: '',
    scrapeUrl: 'https://www.anthropic.com/news',
    category: 'company',
  },
  {
    name: 'Meta AI Blog',
    url: '',
    scrapeUrl: 'https://ai.meta.com/blog/',
    category: 'company',
  },
  {
    name: 'Mistral AI News',
    url: '',
    scrapeUrl: 'https://mistral.ai/news/',
    category: 'company',
  },

  // ── 한국 AI 기업 (RSS) ────────────────────────────────────────────────────
  {
    name: '네이버 D2 Blog',
    url: 'https://d2.naver.com/d2.atom',
    category: 'korean-ai',
    lang: 'ko',
  },
  {
    name: '카카오테크 Blog',
    url: 'https://tech.kakao.com/feed/',
    category: 'korean-ai',
    lang: 'ko',
  },
  {
    name: '카카오엔터프라이즈 Blog',
    url: 'https://kakaoenterprise.github.io/feed.xml',
    category: 'korean-ai',
    lang: 'ko',
  },

  // ── 한국 AI 기업 (cheerio 스크래퍼) ─────────────────────────────────────────
  {
    name: 'Naver CLOVA Tech Blog',
    url: '',
    scrapeUrl: 'https://clova.ai/tech-blog',
    category: 'korean-ai',
    lang: 'ko',
  },
  {
    name: '업스테이지 Blog',
    url: '',
    scrapeUrl: 'https://upstage.ai/blog',
    category: 'korean-ai',
    lang: 'ko',
  },
];

// ── 미지원 소스 (향후 구현 필요) ───────────────────────────────────────────────
// OpenAI      : https://openai.com/news/  (403 차단 — puppeteer 또는 rss.app 필요)
// LG AI 연구원  : https://www.lgresearch.ai/blog  (JS 렌더링 — puppeteer 필요)
// 삼성리서치    : https://research.samsung.com/blog  (JS 렌더링 — puppeteer 필요)
// 현대자동차    : 공개 AI 블로그 미확인
