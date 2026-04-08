import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { prisma } from "@/lib/prisma";
import AdSenseScript from "@/components/AdSenseScript";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://ai-news-kr.vercel.app';

async function getAdSettings(): Promise<{ adsensePublisherId: string }> {
  try {
    const adsenseSetting = await prisma.setting.findUnique({ where: { key: 'adsense_publisher_id' } });
    return { adsensePublisherId: adsenseSetting?.value || '' };
  } catch {
    return { adsensePublisherId: '' };
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const { adsensePublisherId } = await getAdSettings();
  return {
    title: "AI 뉴스 KR — 개발자를 위한 AI 최신 소식",
    description:
      "영어 AI 뉴스를 한국어로 번역·요약해 제공합니다. LLM, 이미지AI, 로봇, 자율주행 등 최신 AI 동향을 빠르게 파악하세요.",
    keywords: ["AI 뉴스", "인공지능", "LLM", "GPT", "머신러닝", "딥러닝", "한국어"],
    metadataBase: new URL(BASE_URL),
    alternates: {
      types: {
        'application/rss+xml': [{ url: '/api/rss', title: 'AI 뉴스 KR' }],
      },
    },
    openGraph: {
      title: "AI 뉴스 KR",
      description: "개발자를 위한 AI 최신 소식 — 한국어 번역·요약",
      type: "website",
      locale: "ko_KR",
      siteName: "AI 뉴스 KR",
    },
    ...(adsensePublisherId && {
      other: { 'google-adsense-account': adsensePublisherId },
    }),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { adsensePublisherId } = await getAdSettings();

  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100`}
      >
        {adsensePublisherId && <AdSenseScript publisherId={adsensePublisherId} />}
        <nav className="sticky top-0 z-50 border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-950/90 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
            <a href="/" className="flex items-center gap-2 font-bold text-lg">
              <span className="text-2xl">🤖</span>
              <span className="hidden sm:inline">AI 뉴스 KR</span>
            </a>
            <span className="text-gray-400 text-sm ml-auto hidden sm:inline">
              개발자를 위한 AI 최신 소식
            </span>
          </div>
        </nav>
        <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
        <footer className="border-t border-gray-200 dark:border-gray-800 mt-12 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>AI 뉴스 KR — 3시간마다 자동 수집 및 번역</p>
        </footer>
      </body>
    </html>
  );
}
