export interface RssSource {
  name: string;
  url: string;
  category?: string;
}

export const RSS_SOURCES: RssSource[] = [
  {
    name: 'The Verge AI',
    url: 'https://www.theverge.com/ai-artificial-intelligence/rss/index.xml',
    category: 'tech',
  },
  {
    name: 'TechCrunch AI',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    category: 'tech',
  },
  {
    name: 'VentureBeat AI',
    url: 'https://venturebeat.com/ai/feed/',
    category: 'tech',
  },
  {
    name: 'Ars Technica',
    url: 'https://feeds.arstechnica.com/arstechnica/technology-lab',
    category: 'tech',
  },
  {
    name: 'MIT Technology Review',
    url: 'https://www.technologyreview.com/feed/',
    category: 'research',
  },
  {
    name: 'Wired',
    url: 'https://www.wired.com/feed/category/artificial-intelligence/latest/rss',
    category: 'tech',
  },
  {
    name: 'HuggingFace Blog',
    url: 'https://huggingface.co/blog/feed.xml',
    category: 'research',
  },
  {
    name: 'OpenAI Blog',
    url: 'https://openai.com/blog/rss/',
    category: 'company',
  },
  {
    name: 'Google DeepMind Blog',
    url: 'https://deepmind.google/blog/rss.xml',
    category: 'research',
  },
];
