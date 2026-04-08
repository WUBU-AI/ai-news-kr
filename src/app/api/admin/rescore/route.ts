import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';

// POST /api/admin/rescore
// Re-scores articles whose importanceScore is exactly 5.
// Pass ?all=true to re-score every article regardless of current score.
// Requires ANTHROPIC_API_KEY to be set in the environment.

async function scoreImportance(title: string, snippet: string): Promise<number> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const prompt = `You are evaluating AI news articles for their importance to software developers and engineers.

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

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '5';
    const score = parseInt(text, 10);
    return isNaN(score) || score < 1 || score > 10 ? 5 : score;
  } catch {
    return 5;
  }
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'ANTHROPIC_API_KEY가 서버에 설정되지 않았습니다.' },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  const rescoreAll = searchParams.get('all') === 'true';

  try {
    const articles = await prisma.article.findMany({
      where: rescoreAll ? undefined : { importanceScore: 5 },
      select: { id: true, originalTitle: true, originalContent: true },
      orderBy: { collectedAt: 'desc' },
    });

    let updated = 0;
    let errors = 0;

    for (const article of articles) {
      try {
        const newScore = await scoreImportance(
          article.originalTitle,
          article.originalContent || '',
        );
        await prisma.article.update({
          where: { id: article.id },
          data: { importanceScore: newScore },
        });
        updated++;
      } catch {
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      total: articles.length,
      updated,
      errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
