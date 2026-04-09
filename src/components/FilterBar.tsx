'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const CATEGORIES = ['LLM', '이미지AI', '로봇', '자율주행', '업계동향', '연구', '기타'] as const;
const STORAGE_KEY = 'ai-news-filter-v2';

interface FilterState {
  categories: string[];
  tags: string[];
}

interface FilterBarProps {
  availableTags?: string[];
}

function buildParams(categories: string[], tags: string[]): string {
  const params = new URLSearchParams();
  for (const cat of categories) params.append('category', cat);
  for (const tag of tags) params.append('tag', tag);
  return params.toString();
}

export default function FilterBar({ availableTags = [] }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);

  const currentCategories = searchParams.getAll('category');
  const currentTags = searchParams.getAll('tag');

  // On mount, restore filter from localStorage if no filter in URL
  useEffect(() => {
    setMounted(true);
    if (currentCategories.length === 0 && currentTags.length === 0) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const { categories, tags } = JSON.parse(stored) as FilterState;
          if (categories.length > 0 || tags.length > 0) {
            const qs = buildParams(categories, tags);
            router.replace(qs ? `${pathname}?${qs}` : pathname);
          }
        }
      } catch {
        // ignore
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function applyFilter(categories: string[], tags: string[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ categories, tags }));
    } catch { /* ignore */ }

    const qs = buildParams(categories, tags);
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function toggleCategory(cat: string) {
    const next = currentCategories.includes(cat)
      ? currentCategories.filter((c) => c !== cat)
      : [...currentCategories, cat];
    applyFilter(next, currentTags);
  }

  function toggleTag(tag: string) {
    const next = currentTags.includes(tag)
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag];
    applyFilter(currentCategories, next);
  }

  function selectAllCategories() {
    applyFilter([...CATEGORIES], currentTags);
  }

  function selectAllTags() {
    applyFilter(currentCategories, [...availableTags]);
  }

  function clearAll() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    router.push(pathname);
  }

  if (!mounted) return null;

  const allCategoriesSelected = CATEGORIES.every((c) => currentCategories.includes(c));
  const allTagsSelected = availableTags.length > 0 && availableTags.every((t) => currentTags.includes(t));
  const hasFilter = currentCategories.length > 0 || currentTags.length > 0;

  return (
    <div className="mb-5 space-y-2">
      {/* Category filter */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-gray-400 dark:text-gray-500 mr-1">카테고리</span>
        <button
          onClick={selectAllCategories}
          disabled={allCategoriesSelected}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            allCategoriesSelected
              ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 border-gray-800 dark:border-gray-200 opacity-50 cursor-not-allowed'
              : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
          }`}
        >
          전체선택
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => toggleCategory(cat)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              currentCategories.includes(cat)
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
          <button
            onClick={selectAllTags}
            disabled={allTagsSelected}
            className={`text-xs px-2 py-0.5 rounded border transition-colors ${
              allTagsSelected
                ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 border-gray-800 dark:border-gray-200 opacity-50 cursor-not-allowed'
                : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
          >
            전체선택
          </button>
          {availableTags.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                currentTags.includes(tag)
                  ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 border-gray-800 dark:border-gray-200'
                  : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Active filters summary + clear */}
      {hasFilter && (
        <div className="flex flex-wrap items-center gap-2">
          {currentCategories.length > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              카테고리: {currentCategories.join(', ')}
            </span>
          )}
          {currentTags.length > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              태그: {currentTags.map((t) => `#${t}`).join(', ')}
            </span>
          )}
          <button
            onClick={clearAll}
            className="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 underline"
          >
            필터 해제
          </button>
        </div>
      )}
    </div>
  );
}
