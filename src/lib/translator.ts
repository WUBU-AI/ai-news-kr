import Anthropic from '@anthropic-ai/sdk';
import { prisma } from './prisma';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const VALID_CATEGORIES = ['LLM', '이미지AI', '로봇', '자율주행', '업계동향', '연구', '기타'] as const;
type Category = (typeof VALID_CATEGORIES)[number];

interface TranslationResult {
  translatedTitle: string;
  summaryBullets: string[];
  engineerNote: string;
  category: Category;
  tags: string[];
}

async function translateAndSummarize(
  originalTitle: string,
  originalContent: string | null
): Promise<TranslationResult> {
  const prompt = `You are an AI news translator and summarizer for Korean software engineers and developers.

Article title (English): ${originalTitle}
Article content/snippet: ${originalContent || '(no content available)'}

Please analyze and respond with ONLY a valid JSON object in this exact format:
{
  "translatedTitle": "한국어로 번역된 제목",
  "summaryBullets": [
    "핵심 내용 1",
    "핵심 내용 2",
    "핵심 내용 3"
  ],
  "engineerNote": "개발자/엔지니어 관점에서 중요한 이유 한 줄",
  "category": "카테고리",
  "tags": ["태그1", "태그2", "태그3"]
}

Rules:
- translatedTitle: Translate the title naturally into Korean
- summaryBullets: 3 to 5 bullet points in Korean summarizing the key points
- engineerNote: One concise Korean sentence explaining why this matters to developers/engineers
- category: Choose exactly ONE from: LLM, 이미지AI, 로봇, 자율주행, 업계동향, 연구, 기타
- tags: 3 to 5 relevant Korean or English tags (short keywords)

Respond with ONLY the JSON object, no other text.`;

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '';

  // Parse JSON response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Invalid JSON response from Claude: ${text.slice(0, 100)}`);
  }

  const parsed = JSON.parse(jsonMatch[0]) as Partial<TranslationResult>;

  const category: Category = VALID_CATEGORIES.includes(parsed.category as Category)
    ? (parsed.category as Category)
    : '기타';

  return {
    translatedTitle: parsed.translatedTitle || originalTitle,
    summaryBullets: Array.isArray(parsed.summaryBullets) ? parsed.summaryBullets.slice(0, 5) : [],
    engineerNote: parsed.engineerNote || '',
    category,
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
  };
}

export interface TranslationSummary {
  articlesTranslated: number;
  errors: string[];
}

export async function translateTopArticles(): Promise<TranslationSummary> {
  // Get collect_count from settings (default 3)
  const setting = await prisma.setting.findUnique({ where: { key: 'collect_count' } });
  const collectCount = setting ? parseInt(setting.value, 10) || 3 : 3;

  // Fetch top N untranslated articles by importance score
  const articles = await prisma.article.findMany({
    where: { translatedTitle: null },
    orderBy: { importanceScore: 'desc' },
    take: collectCount,
    select: {
      id: true,
      originalTitle: true,
      originalContent: true,
    },
  });

  const errors: string[] = [];
  let translated = 0;

  for (const article of articles) {
    try {
      const result = await translateAndSummarize(article.originalTitle, article.originalContent);

      await prisma.article.update({
        where: { id: article.id },
        data: {
          translatedTitle: result.translatedTitle,
          summaryBullets: [...result.summaryBullets, result.engineerNote].filter(Boolean),
          category: result.category,
          tags: result.tags,
        },
      });

      translated++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`[${article.originalTitle.slice(0, 50)}] ${msg}`);
    }
  }

  return { articlesTranslated: translated, errors };
}
