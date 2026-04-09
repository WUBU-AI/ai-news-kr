/**
 * HTML-based web scraper for AI company news/blog pages.
 * Used when no RSS feed is available or the feed is blocked.
 * Returns items in the same shape as rss-parser feed items.
 */

import * as cheerio from 'cheerio';
import { RssSource } from './rss-sources';

export interface ScrapedItem {
  title: string;
  link: string;
  contentSnippet: string;
  pubDate?: string;
  isoDate?: string;
}

type ScraperFn = (html: string, baseUrl: string) => ScrapedItem[];

// ── Per-site scrapers ────────────────────────────────────────────────────────

function scrapeAnthropic(html: string, baseUrl: string): ScrapedItem[] {
  const $ = cheerio.load(html);
  const items: ScrapedItem[] = [];

  // Listing page: <a href="/news/slug"> contains h3 or span for title
  $('a[href^="/news/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href === '/news') return;

    const title =
      $(el).find('h2, h3, h4').first().text().trim() ||
      $(el).find('[class*="title"]').first().text().trim() ||
      $(el).text().trim();

    if (!title || title.length < 5) return;

    const link = href.startsWith('http') ? href : `${baseUrl}${href}`;

    // avoid duplicates
    if (items.some((i) => i.link === link)) return;

    const snippet =
      $(el).find('p, [class*="description"], [class*="excerpt"]').first().text().trim();

    items.push({ title, link, contentSnippet: snippet });
  });

  return items.slice(0, 20);
}

function scrapeMetaAI(html: string, baseUrl: string): ScrapedItem[] {
  const $ = cheerio.load(html);
  const items: ScrapedItem[] = [];

  $('a[href*="/blog/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href === '/blog/' || href === `${baseUrl}/blog/`) return;

    const link = href.startsWith('http') ? href : `${baseUrl}${href}`;
    if (items.some((i) => i.link === link)) return;

    const title =
      $(el).find('h2, h3, h4, [class*="title"]').first().text().trim() ||
      $(el).attr('aria-label') ||
      $(el).text().trim();

    if (!title || title.length < 5) return;

    const snippet = $(el).find('p, [class*="description"]').first().text().trim();
    items.push({ title, link, contentSnippet: snippet });
  });

  return items.slice(0, 20);
}

function scrapeMistral(html: string, baseUrl: string): ScrapedItem[] {
  const $ = cheerio.load(html);
  const items: ScrapedItem[] = [];

  $('a[href^="/news/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href === '/news' || href === '/news/') return;

    const link = href.startsWith('http') ? href : `${baseUrl}${href}`;
    if (items.some((i) => i.link === link)) return;

    const title =
      $(el).find('h2, h3, h4, [class*="title"]').first().text().trim() ||
      $(el).text().trim();

    if (!title || title.length < 5) return;

    const snippet = $(el).find('p, [class*="description"]').first().text().trim();
    items.push({ title, link, contentSnippet: snippet });
  });

  return items.slice(0, 20);
}

function scrapeNaverClova(html: string, baseUrl: string): ScrapedItem[] {
  const $ = cheerio.load(html);
  const items: ScrapedItem[] = [];

  $('a[href^="/tech-blog/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || /\/tech-blog\/(tag|$)/.test(href)) return;

    const link = href.startsWith('http') ? href : `${baseUrl}${href}`;
    if (items.some((i) => i.link === link)) return;

    // Decode URL-encoded Korean slug as fallback title
    const slugTitle = decodeURIComponent(href.replace('/tech-blog/', '').replace(/-/g, ' '));
    const title =
      $(el).find('h2, h3, h4, [class*="title"]').first().text().trim() ||
      $(el).text().trim() ||
      slugTitle;

    if (!title || title.length < 3) return;

    const snippet = $(el).find('p, [class*="description"]').first().text().trim();
    items.push({ title, link, contentSnippet: snippet });
  });

  return items.slice(0, 20);
}

function scrapeUpstage(html: string, baseUrl: string): ScrapedItem[] {
  const $ = cheerio.load(html);
  const items: ScrapedItem[] = [];

  $('a[href*="/blog/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href === '/blog' || href === '/blog/') return;
    // Skip language/category index pages
    if (/\/blog\/(en|ko)?\/?$/.test(href)) return;

    const link = href.startsWith('http') ? href : `https://upstage.ai${href}`;
    if (items.some((i) => i.link === link)) return;

    const title =
      $(el).find('h2, h3, h4, [class*="title"]').first().text().trim() ||
      $(el).text().trim();

    if (!title || title.length < 5) return;

    const snippet = $(el).find('p, [class*="description"]').first().text().trim();
    items.push({ title, link, contentSnippet: snippet });
  });

  return items.slice(0, 20);
}

// ── Scraper registry ─────────────────────────────────────────────────────────

const SCRAPERS: Record<string, ScraperFn> = {
  'www.anthropic.com': scrapeAnthropic,
  'ai.meta.com': scrapeMetaAI,
  'mistral.ai': scrapeMistral,
  'clova.ai': scrapeNaverClova,
  'upstage.ai': scrapeUpstage,
};

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Scrape a web page and return article items.
 * Returns null if no matching scraper is found or on error.
 */
export async function scrapeSource(source: RssSource): Promise<ScrapedItem[] | null> {
  const scrapeUrl = source.scrapeUrl;
  if (!scrapeUrl) return null;

  let hostname: string;
  let baseUrl: string;
  try {
    const parsed = new URL(scrapeUrl);
    hostname = parsed.hostname;
    baseUrl = `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return null;
  }

  const scraperFn = SCRAPERS[hostname];
  if (!scraperFn) return null;

  const response = await fetch(scrapeUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${scrapeUrl}`);
  }

  const html = await response.text();
  return scraperFn(html, baseUrl);
}
