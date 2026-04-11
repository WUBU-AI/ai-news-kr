import { ImageResponse } from 'next/og';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const alt = 'AI 뉴스 KR';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface Props {
  params: { id: string };
}

export default async function ArticleOgImage({ params }: Props) {
  let title = 'AI 뉴스 KR';
  let category = '';

  try {
    const article = await prisma.article.findUnique({
      where: { id: params.id },
      select: { translatedTitle: true, originalTitle: true, category: true },
    });
    if (article) {
      title = article.translatedTitle || article.originalTitle;
      category = article.category ?? '';
    }
  } catch {
    // fallback to defaults
  }

  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f2a4a 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '60px 80px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <span style={{ fontSize: 40 }}>🤖</span>
          <span style={{ color: '#94a3b8', fontSize: 28, fontWeight: 'bold' }}>
            AI 뉴스 KR
          </span>
          {category && (
            <span
              style={{
                background: 'rgba(99, 102, 241, 0.2)',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                borderRadius: 8,
                padding: '4px 16px',
                color: '#a5b4fc',
                fontSize: 22,
                marginLeft: 8,
              }}
            >
              {category}
            </span>
          )}
        </div>

        <div
          style={{
            fontSize: title.length > 40 ? 44 : 52,
            fontWeight: 'bold',
            color: '#f8fafc',
            lineHeight: 1.3,
            maxWidth: 1040,
          }}
        >
          {title.length > 80 ? title.slice(0, 77) + '...' : title}
        </div>

        <div
          style={{
            color: '#64748b',
            fontSize: 24,
          }}
        >
          개발자를 위한 AI 최신 소식 — 한국어 번역·요약
        </div>
      </div>
    ),
    { ...size }
  );
}
