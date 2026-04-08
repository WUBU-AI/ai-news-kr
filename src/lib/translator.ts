import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { prisma } from './prisma';

// Supported local CLI translate models
export type TranslateModel = 'claude_cli' | 'gemini_cli' | 'codex_cli';

const VALID_CATEGORIES = ['LLM', '이미지AI', '로봇', '자율주행', '업계동향', '연구', '기타'] as const;
type Category = (typeof VALID_CATEGORIES)[number];

interface TranslationResult {
  translatedTitle: string;
  summaryBullets: string[];
  engineerNote: string;
  category: Category;
  tags: string[];
}

function buildPrompt(originalTitle: string, originalContent: string | null): string {
  return `You are an AI news translator and summarizer for Korean software engineers and developers.

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
}

function runCli(model: TranslateModel, prompt: string): string {
  // Write prompt to a temp file to avoid shell injection and arg length limits
  const tmpFile = path.join(os.tmpdir(), `ai-news-translate-${Date.now()}.txt`);
  try {
    fs.writeFileSync(tmpFile, prompt, 'utf8');

    let cmd: string;
    switch (model) {
      case 'claude_cli':
        cmd = `claude -p "$(cat ${tmpFile})"`;
        break;
      case 'gemini_cli':
        cmd = `gemini -p "$(cat ${tmpFile})"`;
        break;
      case 'codex_cli':
        cmd = `codex exec "$(cat ${tmpFile})"`;
        break;
    }

    const output = execSync(cmd, {
      timeout: 60_000,
      encoding: 'utf8',
      shell: '/bin/bash',
    });

    return output.trim();
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

function parseResponse(text: string, originalTitle: string): TranslationResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`No JSON found in CLI response: ${text.slice(0, 100)}`);
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

async function translateAndSummarize(
  originalTitle: string,
  originalContent: string | null,
  model: TranslateModel
): Promise<TranslationResult> {
  const prompt = buildPrompt(originalTitle, originalContent);
  const text = runCli(model, prompt);
  return parseResponse(text, originalTitle);
}

export interface TranslationSummary {
  articlesTranslated: number;
  modelUsed: TranslateModel;
  errors: string[];
}

export async function translateTopArticles(): Promise<TranslationSummary> {
  // Read settings: collect_count (default 3) and translate_model (default claude_cli)
  const [countSetting, modelSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'collect_count' } }),
    prisma.setting.findUnique({ where: { key: 'translate_model' } }),
  ]);

  const collectCount = countSetting ? parseInt(countSetting.value, 10) || 10 : 10;
  const modelValue = modelSetting?.value as TranslateModel | undefined;
  const model: TranslateModel =
    modelValue && ['claude_cli', 'gemini_cli', 'codex_cli'].includes(modelValue)
      ? modelValue
      : 'claude_cli';

  // Fetch top N untranslated articles by importance score
  const articles = await prisma.article.findMany({
    where: { translatedTitle: null },
    orderBy: { importanceScore: 'desc' },
    take: collectCount,
    select: { id: true, originalTitle: true, originalContent: true },
  });

  const errors: string[] = [];
  let translated = 0;

  for (const article of articles) {
    try {
      const result = await translateAndSummarize(article.originalTitle, article.originalContent, model);

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

  return { articlesTranslated: translated, modelUsed: model, errors };
}
