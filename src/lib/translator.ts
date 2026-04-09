import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { prisma } from './prisma';
import { ollamaTranslateBasic, ollamaDetailedSummary } from './ollama';

// Supported local CLI translate models
export type TranslateModel = 'claude_cli' | 'gemini_cli' | 'codex_cli';

const VALID_CATEGORIES = ['LLM', '이미지AI', '로봇', '자율주행', '업계동향', '연구', '기타'] as const;
type Category = (typeof VALID_CATEGORIES)[number];

interface TranslationResult {
  translatedTitle: string;
  summaryBullets: string[];
  engineerNote: string;
  detailedSummary: string;
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
  "detailedSummary": "2~4 문단으로 구성된 더 상세한 한국어 내용. 기술적 배경, 작동 원리, 실제 영향, 개발자가 알아야 할 세부사항을 포함한다.",
  "category": "카테고리",
  "tags": ["태그1", "태그2", "태그3"]
}

Rules:
- translatedTitle: Translate the title naturally into Korean
- summaryBullets: 3 to 5 bullet points in Korean summarizing the key points
- engineerNote: One concise Korean sentence explaining why this matters to developers/engineers
- detailedSummary: 2 to 4 paragraphs in Korean with deeper analysis — technical background, how it works, real-world impact, and what developers should know. Each paragraph separated by a newline.
- category: Choose exactly ONE from: LLM, 이미지AI, 로봇, 자율주행, 업계동향, 연구, 기타
- tags: 3 to 5 relevant Korean or English tags (short keywords)

Respond with ONLY the JSON object, no other text.`;
}

/** Prompt for Korean-language articles — summarize only, no translation needed. */
function buildKoreanPrompt(originalTitle: string, originalContent: string | null): string {
  return `당신은 한국 소프트웨어 엔지니어를 위한 AI 뉴스 요약 전문가입니다.

기사 제목 (한국어): ${originalTitle}
기사 내용/발췌: ${originalContent || '(내용 없음)'}

아래 JSON 형식으로만 응답하세요:
{
  "translatedTitle": "원문 제목 그대로 사용",
  "summaryBullets": [
    "핵심 내용 1",
    "핵심 내용 2",
    "핵심 내용 3"
  ],
  "engineerNote": "개발자/엔지니어 관점에서 중요한 이유 한 줄",
  "detailedSummary": "2~4 문단으로 구성된 상세 요약. 기술적 배경, 작동 원리, 실제 영향, 개발자가 알아야 할 세부사항을 포함한다.",
  "category": "카테고리",
  "tags": ["태그1", "태그2", "태그3"]
}

규칙:
- translatedTitle: 원문 제목을 그대로 사용 (번역 불필요)
- summaryBullets: 핵심 내용 3~5개를 한국어로 정리
- engineerNote: 개발자에게 왜 중요한지 한 문장으로
- detailedSummary: 2~4 문단의 상세 요약 (각 문단은 줄바꿈으로 구분)
- category: LLM, 이미지AI, 로봇, 자율주행, 업계동향, 연구, 기타 중 하나
- tags: 관련 태그 3~5개

JSON만 응답하고 다른 텍스트는 포함하지 마세요.`;
}

function buildDetailedSummaryPrompt(originalTitle: string, originalContent: string | null): string {
  return `You are an AI news analyst for Korean software engineers.

Article title: ${originalTitle}
Content: ${originalContent || '(no content available)'}

Write a detailed analysis in Korean (2 to 4 paragraphs) covering:
- Technical background and how the technology works
- Real-world impact for developers/engineers
- What developers should know or take action on

Each paragraph separated by a newline. Output ONLY the analysis text in Korean, no titles or extra commentary.`;
}

function buildKoreanDetailedPrompt(originalTitle: string, originalContent: string | null): string {
  return `당신은 한국 소프트웨어 엔지니어를 위한 AI 기사 분석가입니다.

기사 제목: ${originalTitle}
기사 내용: ${originalContent || '(내용 없음)'}

다음 내용을 포함하여 2~4 문단의 상세 분석을 한국어로 작성하세요:
- 기술적 배경 및 작동 원리
- 개발자/엔지니어에게 미치는 실질적인 영향
- 개발자가 알아야 할 사항 또는 취해야 할 행동

각 문단은 줄바꿈으로 구분하세요. 제목이나 부가 설명 없이 분석 텍스트만 출력하세요.`;
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
    detailedSummary: parsed.detailedSummary || '',
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
  modelUsed: string;
  hybridMode: boolean;
  errors: string[];
}

export async function translateTopArticles(): Promise<TranslationSummary> {
  // Read settings
  const [countSetting, modelSetting, maxSetting, thresholdSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'collect_count' } }),
    prisma.setting.findUnique({ where: { key: 'translate_model' } }),
    prisma.setting.findUnique({ where: { key: 'claude_max_articles' } }),
    prisma.setting.findUnique({ where: { key: 'claude_score_threshold' } }),
  ]);

  const collectCount = countSetting ? parseInt(countSetting.value, 10) || 10 : 10;
  const modelValue = modelSetting?.value as TranslateModel | undefined;
  const model: TranslateModel =
    modelValue && ['claude_cli', 'gemini_cli', 'codex_cli'].includes(modelValue)
      ? modelValue
      : 'claude_cli';

  // B-3 하이브리드 설정: claude_max_articles > 0 이면 하이브리드 모드 활성화
  const claudeMaxArticles = maxSetting ? Math.max(0, parseInt(maxSetting.value, 10) || 0) : 3;
  const claudeScoreThreshold = thresholdSetting ? parseInt(thresholdSetting.value, 10) || 7 : 7;
  const hybridMode = claudeMaxArticles > 0;

  // Fetch top N untranslated articles by importance score
  const articles = await prisma.article.findMany({
    where: { translatedTitle: null },
    orderBy: { importanceScore: 'desc' },
    take: collectCount,
    select: { id: true, originalTitle: true, originalContent: true, importanceScore: true, isKorean: true },
  });

  const errors: string[] = [];
  let translated = 0;

  if (!hybridMode) {
    // 표준 모드: 설정된 CLI 모델로 전체 번역/요약
    for (const article of articles) {
      try {
        // 한국어 기사는 번역 없이 요약만
        const prompt = article.isKorean
          ? buildKoreanPrompt(article.originalTitle, article.originalContent)
          : buildPrompt(article.originalTitle, article.originalContent);

        const text = runCli(model, prompt);
        const result = parseResponse(text, article.originalTitle);

        await prisma.article.update({
          where: { id: article.id },
          data: {
            translatedTitle: result.translatedTitle,
            summaryBullets: [...result.summaryBullets, result.engineerNote].filter(Boolean),
            detailedSummary: result.detailedSummary || null,
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
  } else {
    // B-3 하이브리드 모드:
    //   - 기본 번역 (제목, 불릿, 카테고리, 태그): 모든 기사에 Ollama
    //   - 상세 분석: 스코어 ≥ threshold인 상위 N개만 Claude CLI, 나머지 Ollama
    //   - 한국어 기사: 번역 없이 요약만 (Ollama 한국어 프롬프트)
    const claudeEligibleIds = new Set(
      articles
        .filter((a) => a.importanceScore >= claudeScoreThreshold)
        .sort((a, b) => b.importanceScore - a.importanceScore)
        .slice(0, claudeMaxArticles)
        .map((a) => a.id),
    );

    for (const article of articles) {
      try {
        let basic;
        if (article.isKorean) {
          // 한국어 기사: Ollama로 요약만 (번역 건너뜀)
          basic = await ollamaTranslateBasic(article.originalTitle, article.originalContent, true);
        } else {
          // 영어 기사: Ollama로 번역 + 요약
          basic = await ollamaTranslateBasic(article.originalTitle, article.originalContent, false);
        }

        // 상세 분석 (Claude CLI 또는 Ollama)
        let detailedSummary: string;
        if (claudeEligibleIds.has(article.id)) {
          const detailedPrompt = article.isKorean
            ? buildKoreanDetailedPrompt(article.originalTitle, article.originalContent)
            : buildDetailedSummaryPrompt(article.originalTitle, article.originalContent);
          detailedSummary = runCli(model, detailedPrompt);
        } else {
          detailedSummary = await ollamaDetailedSummary(article.originalTitle, article.originalContent, article.isKorean);
        }

        await prisma.article.update({
          where: { id: article.id },
          data: {
            translatedTitle: basic.translatedTitle,
            summaryBullets: [...basic.summaryBullets, basic.engineerNote].filter(Boolean),
            detailedSummary: detailedSummary || null,
            category: basic.category,
            tags: basic.tags,
          },
        });

        translated++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`[${article.originalTitle.slice(0, 50)}] ${msg}`);
      }
    }
  }

  return {
    articlesTranslated: translated,
    modelUsed: hybridMode ? `hybrid (Ollama + ${model})` : model,
    hybridMode,
    errors,
  };
}
