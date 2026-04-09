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
 */
export async function ollamaTranslateBasic(
  title: string,
  content: string | null,
): Promise<OllamaBasicResult> {
  const prompt = `You are an AI news translator and summarizer for Korean software engineers and developers.

Article title (English): ${title}
Article content/snippet: ${content || '(no content available)'}

Respond with ONLY a valid JSON object in this exact format:
{
  "translatedTitle": "한국어로 자연스럽게 번역된 제목",
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
    summaryBullets: Array.isArray(parsed.summaryBullets) ? parsed.summaryBullets.slice(0, 5) : [],
    engineerNote: parsed.engineerNote || '',
    category,
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
  };
}

/**
 * AI 뉴스 기사의 상세 분석 단락을 Ollama로 생성한다.
 * 기술적 배경, 실용적 영향, 개발자 관점의 분석을 2~3문단으로 반환한다.
 */
export async function ollamaDetailedSummary(
  title: string,
  content: string | null,
): Promise<string> {
  const prompt = `You are an AI news analyst for Korean software engineers.

Article title: ${title}
Content: ${content || '(no content available)'}

Write a detailed analysis in Korean covering:
1. Technical background and how the technology works
2. Real-world impact for developers/engineers
3. What developers should watch out for or take action on

Write 2 to 3 paragraphs separated by newlines. Output ONLY the analysis text in Korean, no titles or extra commentary.`;

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
