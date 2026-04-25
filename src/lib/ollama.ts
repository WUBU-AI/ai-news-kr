// src/lib/ollama.ts
// Ollama qwen3:8b 클라이언트 — AI 뉴스 번역/요약용 (B-3 하이브리드 방식)

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'qwen3:8b';

const VALID_CATEGORIES = ['LLM', '이미지AI', '로봇', '자율주행', '업계동향', '연구', '기타'] as const;
type Category = (typeof VALID_CATEGORIES)[number];

async function ollamaGenerate(prompt: string, timeoutMs = 90_000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        think: false,       // qwen3 reasoning 모드 비활성화 (속도 우선)
        options: { temperature: 0.3 },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Ollama API 오류: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as { response: string };
    // qwen3 계열 <think>...</think> 블록 제거
    return data.response.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  } finally {
    clearTimeout(timer);
  }
}

export interface OllamaBasicResult {
  translatedTitle: string;
  summaryBullets: string[];
  engineerNote: string;
  category: Category;
  tags: string[];
}

/**
 * AI 뉴스 기사의 기본 번역·요약을 Ollama로 생성한다.
 * 제목 번역, 핵심 불릿, 엔지니어 노트, 카테고리, 태그를 반환한다.
 * @param isKorean 한국어 기사인 경우 true — 번역 없이 요약만 생성
 */
export async function ollamaTranslateBasic(
  title: string,
  content: string | null,
  isKorean = false,
): Promise<OllamaBasicResult> {
  const prompt = isKorean
    ? `당신은 한국 소프트웨어 엔지니어를 위한 AI 뉴스 심층 분석 전문가입니다. 단순 요약을 넘어 독자에게 고유한 가치를 제공하는 분석을 생성하세요.

기사 제목 (한국어): ${title}
기사 내용/발췌: ${content || '(내용 없음)'}

아래 JSON 형식으로만 응답하세요:
{
  "translatedTitle": "${title}",
  "summaryBullets": [
    "핵심 내용 1 — 구체적인 사실, 수치, 기술적 세부사항 포함",
    "핵심 내용 2 — 구체적인 사실, 수치, 기술적 세부사항 포함",
    "핵심 내용 3 — 구체적인 사실, 수치, 기술적 세부사항 포함",
    "핵심 내용 4 — 구체적인 사실, 수치, 기술적 세부사항 포함",
    "핵심 내용 5 — 구체적인 사실, 수치, 기술적 세부사항 포함"
  ],
  "engineerNote": "개발자가 지금 당장 알아야 할 가장 중요한 실무적 시사점 한 줄",
  "category": "카테고리",
  "tags": ["태그1", "태그2", "태그3", "태그4", "태그5"]
}

규칙:
- translatedTitle: 원문 제목 그대로 사용 (번역 불필요)
- summaryBullets: 정확히 5개. 각 항목에 구체적 사실, 수치, 기술적 세부사항 포함. 막연한 일반론 금지.
- engineerNote: 개발자에게 바로 적용 가능한 구체적 실무 시사점 한 문장
- category: LLM, 이미지AI, 로봇, 자율주행, 업계동향, 연구, 기타 중 하나
- tags: 관련 태그 4~5개 (제목 단어 반복 금지)

JSON만 응답하세요.`
    : `You are an expert AI news analyst and translator for Korean software engineers and developers. Your goal is to produce high-quality, in-depth Korean analysis that provides genuine value beyond simple translation.

Article title (English): ${title}
Article content/snippet: ${content || '(no content available)'}

Respond with ONLY a valid JSON object in this exact format:
{
  "translatedTitle": "한국어로 정확하고 자연스럽게 번역된 제목",
  "summaryBullets": [
    "핵심 내용 1 — 구체적인 사실, 수치, 또는 기술적 세부사항 포함",
    "핵심 내용 2 — 구체적인 사실, 수치, 또는 기술적 세부사항 포함",
    "핵심 내용 3 — 구체적인 사실, 수치, 또는 기술적 세부사항 포함",
    "핵심 내용 4 — 구체적인 사실, 수치, 또는 기술적 세부사항 포함",
    "핵심 내용 5 — 구체적인 사실, 수치, 또는 기술적 세부사항 포함"
  ],
  "engineerNote": "개발자/엔지니어가 지금 당장 알아야 할 가장 중요한 실무적 시사점 한 줄",
  "category": "카테고리",
  "tags": ["태그1", "태그2", "태그3", "태그4", "태그5"]
}

Rules:
- translatedTitle: Translate the title precisely and naturally into Korean
- summaryBullets: EXACTLY 5 bullet points in Korean. Each must include specific facts, numbers, model names, or concrete technical details. Avoid vague generalities.
- engineerNote: One specific Korean sentence about immediate practical impact — include actionable insight or concrete recommendation
- category: Choose exactly ONE from: LLM, 이미지AI, 로봇, 자율주행, 업계동향, 연구, 기타
- tags: 4 to 5 relevant Korean or English tags (short keywords, not duplicating title words)

Respond with ONLY the JSON object, no other text.`;

  const raw = await ollamaGenerate(prompt);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Ollama 기본 번역: JSON 파싱 실패 — ${raw.slice(0, 80)}`);
  }

  const parsed = JSON.parse(jsonMatch[0]) as Partial<OllamaBasicResult>;
  const category: Category = VALID_CATEGORIES.includes(parsed.category as Category)
    ? (parsed.category as Category)
    : '기타';

  return {
    translatedTitle: parsed.translatedTitle || title,
    summaryBullets: Array.isArray(parsed.summaryBullets) ? parsed.summaryBullets.slice(0, 6) : [],
    engineerNote: parsed.engineerNote || '',
    category,
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
  };
}

/**
 * AI 뉴스 기사의 상세 분석 단락을 Ollama로 생성한다.
 * 기술적 배경, 실용적 영향, 개발자 관점의 분석을 2~3문단으로 반환한다.
 * @param isKorean 한국어 기사인 경우 true — 번역 없이 분석만 생성
 */
export async function ollamaDetailedSummary(
  title: string,
  content: string | null,
  isKorean = false,
): Promise<string> {
  const prompt = isKorean
    ? `당신은 한국 소프트웨어 엔지니어를 위한 AI 기사 심층 분석가입니다. 단순 요약을 넘어 독자에게 고유한 가치를 제공하는 심층 분석을 작성하세요.

기사 제목: ${title}
기사 내용: ${content || '(내용 없음)'}

다음 구조에 따라 4~5 문단의 심층 분석을 한국어로 작성하세요. 각 문단은 최소 3문장, 총 600자 이상:

1문단: 이 기술의 배경과 기존 방식과의 차이점을 구체적으로 서술.
2문단: 발표·발견된 구체적 내용, 수치, 기능, 메커니즘을 상세히 서술.
3문단: AI 산업, 개발자 생태계, 경쟁 구도에 미치는 영향 분석.
4문단: 개발자 워크플로우, 도구 선택, 기술 스택에 미치는 구체적 실무 영향.
5문단: 이 발전의 장기적 의미와 앞으로 주목해야 할 방향.

각 문단은 빈 줄로 구분하세요. 섹션 제목 없이 분석 텍스트만 출력하세요.`
    : `You are an expert AI news analyst for Korean software engineers. Write in-depth analysis that provides genuine value beyond simple summarization.

Article title: ${title}
Content: ${content || '(no content available)'}

Write a comprehensive analysis in Korean with 4 to 5 paragraphs. Each paragraph at least 3 sentences. Total at least 600 Korean characters:

Paragraph 1: Technical background — explain what problem this solves and how it differs from previous approaches.
Paragraph 2: Specific details — describe the announced features, benchmarks, numbers, or mechanisms in detail.
Paragraph 3: Industry impact — analyze effects on the AI industry, developer ecosystem, and competitive landscape.
Paragraph 4: Developer workflow impact — concrete effects on tools, technology stacks, APIs, or project planning.
Paragraph 5: Implications and outlook — analytical perspective on long-term meaning and what to watch next.

Separate each paragraph with a blank line. Output ONLY the analysis text in Korean, no section labels or titles.`;

  return ollamaGenerate(prompt, 120_000);
}

/**
 * Ollama 서버 접속 가능 여부 확인
 */
export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
