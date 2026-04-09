'use client';

import { useState } from 'react';

type RssSource = {
  name: string;
  url: string;
  enabled: boolean;
};

interface Props {
  initialSettings: Record<string, string>;
  initialSources: RssSource[];
}

export default function SettingsForm({ initialSettings, initialSources }: Props) {
  const [settings, setSettings] = useState({
    collect_interval_hours: initialSettings['collect_interval_hours'] || '3',
    collect_count: initialSettings['collect_count'] || '3',
    translate_model: initialSettings['translate_model'] || 'claude_cli',
    claude_max_articles: initialSettings['claude_max_articles'] || '3',
    claude_score_threshold: initialSettings['claude_score_threshold'] || '7',
    anthropic_api_key: initialSettings['anthropic_api_key'] || '',
    adsense_publisher_id: initialSettings['adsense_publisher_id'] || '',
    coupang_tracking_id: initialSettings['coupang_tracking_id'] || '',
    google_search_console_code: initialSettings['google_search_console_code'] || '',
    naver_search_advisor_code: initialSettings['naver_search_advisor_code'] || '',
  });
  const [sources, setSources] = useState<RssSource[]>(initialSources);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const payload = {
        ...settings,
        rss_sources: JSON.stringify(sources),
      };
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('저장 실패');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 중 오류 발생');
    } finally {
      setSaving(false);
    }
  }

  function toggleSource(index: number) {
    setSources((prev) =>
      prev.map((s, i) => (i === index ? { ...s, enabled: !s.enabled } : s))
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-8">
      {/* 수집 설정 */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">수집 설정</h2>

        <div>
          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
            수집 주기 (시간 단위, 기본값 3)
          </label>
          <input
            type="number"
            min={1}
            max={24}
            value={settings.collect_interval_hours}
            onChange={(e) => setSettings((p) => ({ ...p, collect_interval_hours: e.target.value }))}
            className="w-32 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">뉴스 자동 수집 간격 (1~24시간). 변경 후 서버 재시작 필요.</p>
        </div>

        <div>
          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
            수집 기사 수 N (기본값 3)
          </label>
          <input
            type="number"
            min={1}
            max={50}
            value={settings.collect_count}
            onChange={(e) => setSettings((p) => ({ ...p, collect_count: e.target.value }))}
            className="w-32 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">매 수집 시 번역할 기사 최대 수</p>
        </div>

        <div>
          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">번역 모델</label>
          <select
            value={settings.translate_model}
            onChange={(e) => setSettings((p) => ({ ...p, translate_model: e.target.value }))}
            className="w-48 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="claude_cli">Claude CLI</option>
            <option value="gemini_cli">Gemini CLI</option>
            <option value="codex_cli">Codex CLI</option>
          </select>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            표준 모드 또는 B-3 하이브리드 모드에서 상세 분석에 사용할 CLI 모델
          </p>
        </div>
      </section>

      {/* B-3 하이브리드 번역 설정 */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
        <div className="flex items-start gap-2 mb-1">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">B-3 하이브리드 번역 설정</h2>
          {parseInt(settings.claude_max_articles) > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium shrink-0 mt-0.5">
              활성화
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
          핵심 요약(불릿)은 모든 기사에 Ollama(qwen3:8b)를 사용합니다.
          상세 분석은 중요도 기준 이상인 상위 N개에만 선택한 CLI 모델을 사용하고, 나머지는 Ollama를 사용합니다.
          <strong className="text-gray-600 dark:text-gray-300"> Claude 최대 기사 수를 0으로 설정하면 모든 기사에 위에서 선택한 CLI 모델이 사용됩니다 (표준 모드).</strong>
        </p>

        <div>
          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
            Claude 상세 분석 최대 기사 수 (기본값 3, 0 = 표준 모드)
          </label>
          <input
            type="number"
            min={0}
            max={10}
            value={settings.claude_max_articles}
            onChange={(e) => setSettings((p) => ({ ...p, claude_max_articles: e.target.value }))}
            className="w-24 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            중요도 스코어 기준을 충족하는 기사 중 최대 N개에만 Claude로 상세 분석을 생성합니다 (0~10).
          </p>
        </div>

        <div>
          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
            Claude 사용 최소 중요도 스코어 (기본값 7, 범위 1~10)
          </label>
          <input
            type="number"
            min={1}
            max={10}
            value={settings.claude_score_threshold}
            onChange={(e) => setSettings((p) => ({ ...p, claude_score_threshold: e.target.value }))}
            className="w-24 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            이 값 이상의 중요도 기사에만 Claude 상세 분석 대상이 됩니다.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">뉴스 소스</label>
          <div className="space-y-2">
            {sources.map((source, i) => (
              <div key={source.url} className="flex items-center justify-between py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{source.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{source.url}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleSource(i)}
                  className={`ml-3 shrink-0 relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${source.enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${source.enabled ? 'translate-x-4' : 'translate-x-1'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* API 키 */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">API 키</h2>

        <div>
          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Anthropic API Key</label>
          <input
            type="password"
            placeholder="sk-ant-..."
            value={settings.anthropic_api_key}
            onChange={(e) => setSettings((p) => ({ ...p, anthropic_api_key: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </section>

      {/* 광고 설정 */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">광고 설정</h2>

        <div>
          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Google AdSense Publisher ID</label>
          <input
            type="text"
            placeholder="pub-0000000000000000"
            value={settings.adsense_publisher_id}
            onChange={(e) => setSettings((p) => ({ ...p, adsense_publisher_id: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">쿠팡 파트너스 Tracking ID</label>
          <input
            type="text"
            placeholder="coupang-tracking-id"
            value={settings.coupang_tracking_id}
            onChange={(e) => setSettings((p) => ({ ...p, coupang_tracking_id: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </section>

      {/* SEO 설정 */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">SEO 설정</h2>

        <div>
          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
            Google Search Console 인증 코드
          </label>
          <input
            type="text"
            placeholder="google-site-verification=XXXXXXXXXXXXXXXX"
            value={settings.google_search_console_code}
            onChange={(e) => setSettings((p) => ({ ...p, google_search_console_code: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            입력 후 저장하면 <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">/google[code].html</code> 경로로 자동 인증됩니다.
          </p>
        </div>

        <div>
          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
            네이버 서치어드바이저 인증 코드
          </label>
          <input
            type="text"
            placeholder="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
            value={settings.naver_search_advisor_code}
            onChange={(e) => setSettings((p) => ({ ...p, naver_search_advisor_code: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            저장하면 <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">&lt;meta name=&quot;naver-site-verification&quot;&gt;</code> 태그가 자동 삽입됩니다.
          </p>
        </div>
      </section>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium text-sm rounded-lg hover:bg-gray-700 dark:hover:bg-gray-100 disabled:opacity-50 transition-colors"
        >
          {saving ? '저장 중...' : '설정 저장'}
        </button>
        {saved && <span className="text-sm text-green-600 dark:text-green-400">저장되었습니다.</span>}
        {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
      </div>
    </form>
  );
}
