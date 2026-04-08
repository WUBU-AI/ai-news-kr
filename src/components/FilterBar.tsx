'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const CATEGORIES = ['LLM', '이미지AI', '로봇', '자율주행', '업계동향', '연구', '기타'] as const;
const STORAGE_KEY = 'ai-news-filter';

interface FilterState {
  category: string | null;
  tag: string | null;
}

interface FilterBarProps {
  availableTags?: string[];
}

export default function FilterBar({ availableTags = [] }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);

  const currentCategory = searchParams.get('category');
  const currentTag = searchParams.get('tag');

  // On mount, restore filter from localStorage if no filter in URL
  useEffect(() => {
    setMounted(true);
    if (!currentCategory && !currentTag) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const { category, tag } = JSON.parse(stored) as FilterState;
          if (category || tag) {
            const params = new URLSearchParams();
            if (category) params.set('category', category);
            if (tag) params.set('tag', tag);
            router.replace(`${pathname}?${params.toString()}`);
          }
        }
      } catch {
        // ignore
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function applyFilter(category: string | null, tag: string | null) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ category, tag }));
    } catch { /* ignore */ }

    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (tag) params.set('tag', tag);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function selectCategory(cat: string) {
    const next = currentCategory === cat ? null : cat;
    applyFilter(next, null);
  }

  function selectTag(tag: string) {
    const next = currentTag === tag ? null : tag;
    applyFilter(null, next);
  }

  function clearAll() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    router.push(pathname);
  }

  if (!mounted) return null;

  const hasFilter = !!(currentCategory || currentTag);

  return (
    <div className="mb-5 space-y-2">
      {/* Category filter */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-gray-400 dark:text-gray-500 mr-1">카테고리</span>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => selectCategory(cat)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              currentCategory === cat
                ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 border-gray-800 dark:border-gray-200'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Tag filter (only show when there are available tags) */}
      {availableTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gray-400 dark:text-gray-500 mr-1">태그</span>
          {availableTags.map((tag) => (
            <button
              key={tag}
              onClick={() => selectTag(tag)}
              className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                currentTag === tag
                  ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 border-gray-800 dark:border-gray-200'
                  : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Clear filter */}
      {hasFilter && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {currentCategory && `카테고리: ${currentCategory}`}
            {currentTag && `태그: #${currentTag}`}
          </span>
          <button
            onClick={clearAll}
            className="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 underline"
          >
            필터 초기화
          </button>
        </div>
      )}
    </div>
  );
}
