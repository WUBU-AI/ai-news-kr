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

// ── Date parsing helper ──────────────────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
  jan: '01', january: '01',
  feb: '02', february: '02',
  mar: '03', march: '03',
  apr: '04', april: '04',
  may: '05',
  jun: '06', june: '06',
  jul: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', september: '09',
  oct: '10', october: '10',
  nov: '11', november: '11',
  dec: '12', december: '12',
};

/**
 * Parse human-readable date strings like "Apr 7, 2026" or "April 2, 2026"
 * Returns an ISO date string ("2026-04-07") or undefined if unparseable.
 */
function parseHumanDate(text: string): string | undefined {
  if (!text) return undefined;
  const cleaned = text.trim();

  // "Apr 7, 2026" or "April 2, 2026" or "Apr 07 2026"
  const match = cleaned.match(
    /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/
  );
  if (match) {
    const month = MONTH_MAP[match[1].toLowerCase()];
    if (!month) return undefined;
    const day = match[2].padStart(2, '0');
    const year = match[3];
    return `${year}-${month}-${day}`;
  }

  // Already ISO-ish: "2026-04-07"
  const isoMatch = cleaned.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  return undefined;
}

// ── Per-site scrapers ────────────────────────────────────────────────────────

function scrapeAnthropic(html: string, baseUrl: string): ScrapedItem[] {
  const $ = cheerio.load(html);
  const items: ScrapedItem[] = [];

  // Listing page: <a href="/news/slug"> contains h3 or span for title
  // and a <time> tag with date text like "Apr 7, 2026"
  $('a[href^="/news/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href === '/news') return;

    const title =
      $(el).find('h2, h3, h4').first().text().trim() ||
      $(el).find('[class*="title"]').first().text().trim() ||
      $(el).text().trim();

    if (!title || title.length < 5) return;

    const link = href.startsWith('http') ? href : `${baseUrl}${href}`;
    if (items.some((i) => i.link === link)) return;

    const snippet =
      $(el).find('p, [class*="description"], [class*="excerpt"]').first().text().trim();

    // <time> tag is inside the <a> link with date text like "Apr 7, 2026"
    const timeText = $(el).find('time').first().text().trim();
    const isoDate = parseHumanDate(timeText);

    items.push({ title, link, contentSnippet: snippet, pubDate: timeText || undefined, isoDate });
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
    // Meta AI blog listing does not expose dates in its HTML —
    // pubDate left undefined; collector will store publishedAt as null
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
      $(el).find('h1, h2, h3, h4').first().text().trim() ||
      $(el).text().trim();

    if (!title || title.length < 5) return;

    const snippet = $(el).find('p, [class*="description"]').first().text().trim();

    // Date is in a div with class containing "text-mistral-black-tint"
    // e.g. <div class="... text-mistral-black-tint">Mar 23, 2026</div>
    const dateText = $(el).find('[class*="black-tint"]').first().text().trim();
    const isoDate = parseHumanDate(dateText);

    items.push({ title, link, contentSnippet: snippet, pubDate: dateText || undefined, isoDate });
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

    const slugTitle = decodeURIComponent(href.replace('/tech-blog/', '').replace(/-/g, ' '));
    const title =
      $(el).find('h2, h3, h4, [class*="title"]').first().text().trim() ||
      $(el).text().trim() ||
      slugTitle;

    if (!title || title.length < 3) return;

    const snippet = $(el).find('p, [class*="description"]').first().text().trim();
    // Clova AI tech blog listing does not expose dates — pubDate undefined
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
    if (/\/blog\/(en|ko)?\/?$/.test(href)) return;

    const link = href.startsWith('http') ? href : `${baseUrl}${href}`;
    if (items.some((i) => i.link === link)) return;

    const title =
      $(el).find('h2, h3, h4, [class*="title"], [fs-cmsfilter-field="name"]').first().text().trim() ||
      $(el).text().trim();

    if (!title || title.length < 5) return;

    const snippet = $(el).find('p, [class*="description"]').first().text().trim();

    // Date is in <div fs-cmssort-field="date" fs-cmssort-type="date">April 2, 2026</div>
    const dateText = $(el).find('[fs-cmssort-field="date"]').first().text().trim();
    const isoDate = parseHumanDate(dateText);

    items.push({ title, link, contentSnippet: snippet, pubDate: dateText || undefined, isoDate });
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
