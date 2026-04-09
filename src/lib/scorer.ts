import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { prisma } from './prisma';
import { TranslateModel } from './translator';

export type ScoreModel = TranslateModel | 'ollama';
export const OLLAMA_SCORE_MODEL = 'qwen3:8b';

const SCORE_PROMPT = (title: string, snippet: string) =>
  `You are evaluating AI news articles for their importance to software developers and engineers.

Article title: ${title}
Summary: ${snippet || '(no summary available)'}

Rate the importance of this article on a scale from 1 to 10 for developers/engineers who want to stay up-to-date with AI.

Scoring guide:
- 10: Major breakthrough, new model release (GPT-5, Claude 4, Gemini 2, etc.), new architecture (Transformer variant, SSM, MoE), critical industry change
- 8-9: New open-source model, significant product launch, important AI framework/library, major API update, new dev tool
- 5-7: Interesting research finding, useful technique, relevant AI trend, performance benchmark
- 3-4: Company news, partnership announcements, opinion pieces with technical insight
- 1-2: Minor update, pure business news, low-technical-relevance content

Priority boost for: new product/architecture releases, open-source releases, practical developer tools, novel techniques.
Downgrade for: opinion only, business-only news, repetitive coverage.

Respond with ONLY a single integer from 1 to 10. No explanation.`;

async function runOllama(prompt: string): Promise<string> {
  const res = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_SCORE_MODEL,
      prompt,
      stream: false,
      think: false,       // disable extended reasoning for speed
      options: { num_predict: 8 },
    }),
  });
  if (!res.ok) {
    throw new Error(`Ollama API error: ${res.status} ${res.statusText}`);
  }
  const json = await res.json() as { response: string };
  // Strip <think>...</think> tags if present (qwen3 reasoning model)
  return json.response.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

function runCli(model: TranslateModel, prompt: string): string {
  const tmpFile = path.join(os.tmpdir(), `ai-news-score-${Date.now()}.txt`);
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

    return execSync(cmd, { timeout: 60_000, encoding: 'utf8', shell: '/bin/bash' }).trim();
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

export async function getScoreModel(): Promise<ScoreModel> {
  // score_model setting takes precedence; default to ollama (local, no API key needed)
  const scoreSetting = await prisma.setting.findUnique({ where: { key: 'score_model' } });
  const valid: ScoreModel[] = ['claude_cli', 'gemini_cli', 'codex_cli', 'ollama'];
  const scoreValue = scoreSetting?.value as ScoreModel | undefined;
  return scoreValue && valid.includes(scoreValue) ? scoreValue : 'ollama';
}

export async function scoreImportance(
  title: string,
  snippet: string,
  model?: ScoreModel,
): Promise<number> {
  const resolvedModel = model ?? (await getScoreModel());
  const prompt = SCORE_PROMPT(title, snippet);

  let output: string;
  if (resolvedModel === 'ollama') {
    output = await runOllama(prompt);
  } else {
    output = runCli(resolvedModel, prompt);
  }

  const score = parseInt(output.match(/\d+/)?.[0] ?? '5', 10);
  return isNaN(score) || score < 1 || score > 10 ? 5 : score;
}
