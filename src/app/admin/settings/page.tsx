import { prisma } from '@/lib/prisma';
import SettingsForm from './SettingsForm';

type RssSource = {
  name: string;
  url: string;
  enabled: boolean;
};

export default async function AdminSettings() {
  const settings: Record<string, string> = {};
  let sources: RssSource[] = [];
  let dbError = false;

  try {
    const rows = await prisma.setting.findMany();
    for (const row of rows) {
      settings[row.key] = row.value;
    }

    // Try to load RSS sources from settings
    const sourcesJson = settings['rss_sources'];
    if (sourcesJson) {
      try {
        sources = JSON.parse(sourcesJson);
      } catch {
        sources = [];
      }
    }
  } catch {
    dbError = true;
  }

  // Load default RSS sources if not in DB
  if (sources.length === 0) {
    const { RSS_SOURCES } = await import('@/lib/rss-sources');
    sources = RSS_SOURCES.map((s) => ({
      name: s.name,
      url: s.url,
      enabled: true,
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">설정 관리</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">수집, API 키, 광고 코드 설정</p>
      </div>

      {dbError && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-red-600 dark:text-red-400">
          데이터베이스 연결 오류가 발생했습니다.
        </div>
      )}

      <SettingsForm initialSettings={settings} initialSources={sources} />
    </div>
  );
}
