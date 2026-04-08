'use client';

import { useState } from 'react';

type RescoreResult = {
  success: boolean;
  total?: number;
  updated?: number;
  errors?: number;
  error?: string;
};

export default function RescoreButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RescoreResult | null>(null);

  async function handleRescore() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/rescore', {
        method: 'POST',
        credentials: 'include',
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
        onClick={handleRescore}
        disabled={loading}
        className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-700 dark:hover:bg-gray-100 disabled:opacity-50 transition-colors"
      >
        {loading ? '재계산 중...' : 'Score 재계산 실행'}
      </button>
      <p className="text-xs text-gray-400 dark:text-gray-500">Score가 5.0인 기사를 수정된 규칙으로 재채점합니다.</p>
      {result && (
        <div className={`text-xs rounded p-2 ${result.success ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>
          {result.success
            ? `완료: 대상 ${result.total}개, 갱신 ${result.updated}개${result.errors ? `, 오류 ${result.errors}개` : ''}`
            : `오류: ${result.error}`}
        </div>
      )}
    </div>
  );
}
