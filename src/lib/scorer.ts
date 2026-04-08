import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { prisma } from './prisma';
import { TranslateModel } from './translator';

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

export async function getScoreModel(): Promise<TranslateModel> {
  const setting = await prisma.setting.findUnique({ where: { key: 'translate_model' } });
  const value = setting?.value as TranslateModel | undefined;
  return value && ['claude_cli', 'gemini_cli', 'codex_cli'].includes(value) ? value : 'claude_cli';
}

export async function scoreImportance(
  title: string,
  snippet: string,
  model?: TranslateModel,
): Promise<number> {
  const resolvedModel = model ?? (await getScoreModel());
  const output = runCli(resolvedModel, SCORE_PROMPT(title, snippet));
  const score = parseInt(output.match(/\d+/)?.[0] ?? '5', 10);
  return isNaN(score) || score < 1 || score > 10 ? 5 : score;
}
