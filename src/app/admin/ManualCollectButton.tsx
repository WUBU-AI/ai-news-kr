'use client';

import { useState } from 'react';

type CollectResult = {
  success: boolean;
  sourcesChecked?: number;
  articlesCollected?: number;
  articlesTranslated?: number;
  error?: string;
};

export default function ManualCollectButton({ cronSecret }: { cronSecret: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CollectResult | null>(null);

  async function handleCollect() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/cron/collect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cronSecret}` },
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ success: false, error: '네트워크 오류' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleCollect}
        disabled={loading}
        className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-700 dark:hover:bg-gray-100 disabled:opacity-50 transition-colors"
      >
        {loading ? '수집 중...' : '지금 수집 실행'}
      </button>
      {result && (
        <div className={`text-xs rounded p-2 ${result.success ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>
          {result.success
            ? `완료: 소스 ${result.sourcesChecked}개, 수집 ${result.articlesCollected}개, 번역 ${result.articlesTranslated}개`
            : `오류: ${result.error}`}
        </div>
      )}
    </div>
  );
}
