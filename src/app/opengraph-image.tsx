import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'AI 뉴스 KR — 개발자를 위한 AI 최신 소식';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
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
          justifyContent: 'center',
          padding: '80px',
        }}
      >
        <div
          style={{
            fontSize: 72,
            marginBottom: 24,
          }}
        >
          🤖
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 'bold',
            color: '#f8fafc',
            lineHeight: 1.1,
            marginBottom: 20,
          }}
        >
          AI 뉴스 KR
        </div>
        <div
          style={{
            fontSize: 32,
            color: '#94a3b8',
            lineHeight: 1.4,
            maxWidth: 900,
          }}
        >
          영어 AI 뉴스를 한국어로 번역·요약
        </div>
        <div
          style={{
            marginTop: 48,
            display: 'flex',
            gap: 16,
          }}
        >
          {['LLM', '이미지AI', '로봇', '자율주행', '업계동향'].map((tag) => (
            <div
              key={tag}
              style={{
                background: 'rgba(99, 102, 241, 0.2)',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                borderRadius: 8,
                padding: '8px 20px',
                color: '#a5b4fc',
                fontSize: 22,
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
