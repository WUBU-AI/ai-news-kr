export interface RssSource {
  name: string;
  url: string;
  category?: string;
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
];

// ── RSS 미제공 — 크롤링 검토 대상 (별도 구현 필요) ─────────────────────────
// OpenAI      : https://openai.com/news/  (RSS 403 차단)
// Anthropic   : https://www.anthropic.com/news  (RSS 없음)
// Mistral AI  : https://mistral.ai/news  (RSS 없음)
// Meta AI     : https://ai.meta.com/blog/  (RSS 404)
//
// 이 소스들은 HTML 스크래퍼(puppeteer / cheerio) 또는
// unofficial RSS 프록시(rss.app, rsshub) 를 통해 수집 가능.
