import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { prisma } from './prisma';
import { ollamaTranslateBasic, ollamaDetailedSummary } from './ollama';
import { selectTranslationTargets } from './article-selector';

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
  return `You are an expert AI news analyst and translator for Korean software engineers and developers. Your goal is to produce high-quality, in-depth Korean analysis that provides genuine value beyond simple translation.

Article title (English): ${originalTitle}
Article content/snippet: ${originalContent || '(no content available)'}

Please analyze deeply and respond with ONLY a valid JSON object in this exact format:
{
  "translatedTitle": "한국어로 번역된 제목",
  "summaryBullets": [
    "핵심 내용 1 — 구체적인 사실, 수치, 또는 기술적 세부사항 포함",
    "핵심 내용 2 — 구체적인 사실, 수치, 또는 기술적 세부사항 포함",
    "핵심 내용 3 — 구체적인 사실, 수치, 또는 기술적 세부사항 포함",
    "핵심 내용 4 — 구체적인 사실, 수치, 또는 기술적 세부사항 포함",
    "핵심 내용 5 — 구체적인 사실, 수치, 또는 기술적 세부사항 포함"
  ],
  "engineerNote": "개발자/엔지니어가 지금 당장 알아야 할 가장 중요한 실무적 시사점 한 줄",
  "detailedSummary": "4~6 문단으로 구성된 심층 한국어 분석. 각 문단은 빈 줄로 구분. 아래 구조를 따를 것:\n\n[기술적 배경] 이 기술·서비스의 배경과 기존 방식과의 차별점을 구체적으로 서술.\n\n[핵심 내용] 발표·발견된 구체적인 내용, 수치, 메커니즘을 상세히 서술.\n\n[산업 및 생태계 영향] AI·소프트웨어 산업과 개발 생태계에 미치는 영향을 분석.\n\n[개발자 실무 영향] 개발자의 워크플로우, 도구 선택, 기술 스택, 프로젝트 계획에 미치는 실질적 영향.\n\n[시사점 및 전망] 이 발전이 의미하는 바와 앞으로 주목해야 할 방향성.",
  "category": "카테고리",
  "tags": ["태그1", "태그2", "태그3", "태그4", "태그5"]
}

Rules:
- translatedTitle: Translate the title precisely and naturally into Korean
- summaryBullets: EXACTLY 5 bullet points in Korean. Each must include specific facts, numbers, model names, or concrete technical details. Avoid vague generalities.
- engineerNote: One specific Korean sentence about immediate practical impact for developers — include actionable insight or concrete recommendation
- detailedSummary: 4 to 6 substantial paragraphs in Korean. Each paragraph must be at least 3 sentences. Cover: (1) technical background, (2) specific announced content, (3) industry/ecosystem impact, (4) developer workflow impact, (5) implications and outlook. Total must be at least 600 Korean characters.
- category: Choose exactly ONE from: LLM, 이미지AI, 로봇, 자율주행, 업계동향, 연구, 기타
- tags: 4 to 5 relevant Korean or English tags (short keywords, not duplicating the title words)

Respond with ONLY the JSON object, no other text.`;
}

/** Prompt for Korean-language articles — summarize only, no translation needed. */
function buildKoreanPrompt(originalTitle: string, originalContent: string | null): string {
  return `당신은 한국 소프트웨어 엔지니어를 위한 AI 뉴스 심층 분석 전문가입니다. 단순 요약을 넘어 독자에게 고유한 가치를 제공하는 심층 분석을 생성하세요.

기사 제목 (한국어): ${originalTitle}
기사 내용/발췌: ${originalContent || '(내용 없음)'}

아래 JSON 형식으로만 응답하세요:
{
  "translatedTitle": "원문 제목 그대로 사용",
  "summaryBullets": [
    "핵심 내용 1 — 구체적인 사실, 수치, 기술적 세부사항 포함",
    "핵심 내용 2 — 구체적인 사실, 수치, 기술적 세부사항 포함",
    "핵심 내용 3 — 구체적인 사실, 수치, 기술적 세부사항 포함",
    "핵심 내용 4 — 구체적인 사실, 수치, 기술적 세부사항 포함",
    "핵심 내용 5 — 구체적인 사실, 수치, 기술적 세부사항 포함"
  ],
  "engineerNote": "개발자가 지금 당장 알아야 할 가장 중요한 실무적 시사점 한 줄",
  "detailedSummary": "4~6 문단으로 구성된 심층 한국어 분석. 각 문단은 빈 줄로 구분. 아래 구조를 따를 것:\n\n[기술적 배경] 이 기술·서비스의 배경과 기존 방식과의 차별점 서술.\n\n[핵심 내용] 발표·발견된 구체적 내용, 수치, 메커니즘 상세 서술.\n\n[산업 및 생태계 영향] AI·소프트웨어 산업과 개발 생태계에 미치는 영향 분석.\n\n[개발자 실무 영향] 개발자 워크플로우, 도구 선택, 기술 스택에 미치는 실질적 영향.\n\n[시사점 및 전망] 이 발전의 의미와 앞으로 주목해야 할 방향성.",
  "category": "카테고리",
  "tags": ["태그1", "태그2", "태그3", "태그4", "태그5"]
}

규칙:
- translatedTitle: 원문 제목을 그대로 사용 (번역 불필요)
- summaryBullets: 정확히 5개. 각 항목에 구체적 사실, 수치, 모델명, 기술적 세부사항 포함. 막연한 일반론 금지.
- engineerNote: 개발자에게 바로 적용 가능한 구체적 실무 시사점 한 문장
- detailedSummary: 4~6개의 충실한 문단 (각 문단 최소 3문장). 총 600자 이상. 기술 배경·핵심 내용·산업 영향·실무 영향·전망을 모두 포함.
- category: LLM, 이미지AI, 로봇, 자율주행, 업계동향, 연구, 기타 중 하나
- tags: 관련 태그 4~5개 (제목 단어 반복 금지)

JSON만 응답하고 다른 텍스트는 포함하지 마세요.`;
}

function buildDetailedSummaryPrompt(originalTitle: string, originalContent: string | null): string {
  return `You are an expert AI news analyst for Korean software engineers. Your analysis must provide genuine, in-depth value that goes beyond simple translation or summarization.

Article title: ${originalTitle}
Content: ${originalContent || '(no content available)'}

Write a comprehensive analysis in Korean with 4 to 6 paragraphs, following this structure exactly:

Paragraph 1 — [기술적 배경]: Explain the technical context, what problem this solves, and how it differs from previous approaches. At least 3 sentences.

Paragraph 2 — [핵심 내용]: Describe the specific announced content, key features, benchmarks, numbers, or mechanisms in detail. At least 3 sentences.

Paragraph 3 — [산업 및 생태계 영향]: Analyze how this affects the AI industry, developer ecosystem, competitive landscape, or market dynamics. At least 3 sentences.

Paragraph 4 — [개발자 실무 영향]: Explain concrete effects on developer workflows, tool choices, technology stacks, API usage, or project planning. At least 3 sentences.

Paragraph 5 — [시사점 및 전망]: Provide your analytical perspective on what this development means long-term and what developers should watch for next. At least 3 sentences.

Separate each paragraph with a blank line. Output ONLY the analysis text in Korean. Do NOT include section labels or headers. Total output must be at least 600 Korean characters.`;
}

function buildKoreanDetailedPrompt(originalTitle: string, originalContent: string | null): string {
  return `당신은 한국 소프트웨어 엔지니어를 위한 AI 기사 심층 분석가입니다. 단순 요약을 넘어 독자에게 고유한 가치를 제공하는 심층 분석을 작성하세요.

기사 제목: ${originalTitle}
기사 내용: ${originalContent || '(내용 없음)'}

다음 구조에 따라 4~6 문단의 심층 분석을 한국어로 작성하세요:

1문단 — [기술적 배경]: 이 기술의 배경, 해결하려는 문제, 기존 방식과의 차이점을 구체적으로 서술. 최소 3문장.

2문단 — [핵심 내용]: 발표·발견된 구체적 내용, 수치, 기능, 메커니즘을 상세히 서술. 최소 3문장.

3문단 — [산업 및 생태계 영향]: AI 산업, 개발자 생태계, 경쟁 구도, 시장 역학에 미치는 영향 분석. 최소 3문장.

4문단 — [개발자 실무 영향]: 개발자 워크플로우, 도구 선택, 기술 스택, API 활용, 프로젝트 계획에 미치는 구체적 영향. 최소 3문장.

5문단 — [시사점 및 전망]: 이 발전의 장기적 의미와 앞으로 개발자가 주목해야 할 방향에 대한 분석적 시각. 최소 3문장.

각 문단은 빈 줄로 구분하세요. 섹션 제목·레이블 없이 분석 텍스트만 출력하세요. 총 출력은 600자 이상이어야 합니다.`;
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
    summaryBullets: Array.isArray(parsed.summaryBullets) ? parsed.summaryBullets.slice(0, 6) : [],
    engineerNote: parsed.engineerNote || '',
    detailedSummary: parsed.detailedSummary || '',
    category,
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
  };
}

/** 최소 콘텐츠 품질 기준 충족 여부 확인. Google AdSense thin-content 방지용. */
function meetsContentQuality(result: TranslationResult): boolean {
  if (result.summaryBullets.length < 3) return false;
  if (!result.detailedSummary || result.detailedSummary.length < 200) return false;
  const paragraphs = result.detailedSummary.split('\n').filter((p) => p.trim().length > 0);
  if (paragraphs.length < 2) return false;
  return true;
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

  // 5단계 필터링을 위해 미번역 기사를 넓게 조회한 뒤 선별
  // (단순 score 상위 N개 → 12시간/중복/소스순서 5단계 필터링으로 교체)
  const candidates = await prisma.article.findMany({
    where: { translatedTitle: null },
    select: {
      id: true,
      sourceName: true,
      originalTitle: true,
      originalContent: true,
      importanceScore: true,
      publishedAt: true,
      isKorean: true,
    },
  });

  const selected = selectTranslationTargets(candidates, collectCount);

  // 선별된 ID 기준으로 isKorean/originalContent 포함한 전체 정보 매핑
  const articleMap = new Map(candidates.map((a) => [a.id, a]));
  const articles = selected.map((s) => articleMap.get(s.id)!).filter(Boolean);

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

        if (!meetsContentQuality(result)) {
          errors.push(`[${article.originalTitle.slice(0, 50)}] 콘텐츠 품질 기준 미달 — 저장 건너뜀 (bullets:${result.summaryBullets.length}, summary:${result.detailedSummary?.length ?? 0}자)`);
          continue;
        }

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

        const hybridResult: TranslationResult = {
          translatedTitle: basic.translatedTitle,
          summaryBullets: basic.summaryBullets,
          engineerNote: basic.engineerNote,
          detailedSummary,
          category: basic.category,
          tags: basic.tags,
        };

        if (!meetsContentQuality(hybridResult)) {
          errors.push(`[${article.originalTitle.slice(0, 50)}] 콘텐츠 품질 기준 미달 — 저장 건너뜀 (bullets:${basic.summaryBullets.length}, summary:${detailedSummary?.length ?? 0}자)`);
          continue;
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
