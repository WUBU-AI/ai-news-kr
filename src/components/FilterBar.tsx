'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const CATEGORIES = ['LLM', '이미지AI', '로봇', '자율주행', '업계동향', '연구', '기타'] as const;
const STORAGE_KEY = 'ai-news-filter-v3';

interface FilterState {
  categories: string[];
  tags: string[];
  sources: string[];
}

interface FilterBarProps {
  availableTags?: string[];
  availableSources?: string[];
  currentSort?: string;
}

function buildParams(categories: string[], tags: string[], sources: string[], sort?: string): string {
  const params = new URLSearchParams();
  if (sort && sort !== 'date') params.set('sort', sort);
  for (const cat of categories) params.append('category', cat);
  for (const tag of tags) params.append('tag', tag);
  for (const src of sources) params.append('source', src);
  return params.toString();
}

export default function FilterBar({ availableTags = [], availableSources = [], currentSort = 'date' }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);

  const currentCategories = searchParams.getAll('category');
  const currentTags = searchParams.getAll('tag');
  const currentSources = searchParams.getAll('source');
  const sort = searchParams.get('sort') ?? currentSort;

  // On mount, restore filter from localStorage if no filter in URL
  useEffect(() => {
    setMounted(true);
    if (currentCategories.length === 0 && currentTags.length === 0 && currentSources.length === 0) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const { categories, tags, sources = [] } = JSON.parse(stored) as FilterState;
          if (categories.length > 0 || tags.length > 0 || sources.length > 0) {
            const qs = buildParams(categories, tags, sources);
            router.replace(qs ? `${pathname}?${qs}` : pathname);
          }
        }
      } catch {
        // ignore
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function applyFilter(categories: string[], tags: string[], sources: string[], newSort?: string) {
    const appliedSort = newSort ?? sort;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ categories, tags, sources }));
    } catch { /* ignore */ }

    const qs = buildParams(categories, tags, sources, appliedSort);
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function changeSort(newSort: string) {
    const qs = buildParams(currentCategories, currentTags, currentSources, newSort);
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function toggleCategory(cat: string) {
    const next = currentCategories.includes(cat)
      ? currentCategories.filter((c) => c !== cat)
      : [...currentCategories, cat];
    applyFilter(next, currentTags, currentSources, sort);
  }

  function toggleTag(tag: string) {
    const next = currentTags.includes(tag)
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag];
    applyFilter(currentCategories, next, currentSources, sort);
  }

  function toggleSource(src: string) {
    const next = currentSources.includes(src)
      ? currentSources.filter((s) => s !== src)
      : [...currentSources, src];
    applyFilter(currentCategories, currentTags, next, sort);
  }

  function selectAllCategories() {
    applyFilter([...CATEGORIES], currentTags, currentSources, sort);
  }

  function selectAllTags() {
    applyFilter(currentCategories, [...availableTags], currentSources, sort);
  }

  function selectAllSources() {
    applyFilter(currentCategories, currentTags, [...availableSources], sort);
  }

  function clearAll() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    router.push(pathname);
  }

  if (!mounted) return null;

  const allCategoriesSelected = CATEGORIES.every((c) => currentCategories.includes(c));
  const allTagsSelected = availableTags.length > 0 && availableTags.every((t) => currentTags.includes(t));
  const allSourcesSelected = availableSources.length > 0 && availableSources.every((s) => currentSources.includes(s));
  const hasFilter = currentCategories.length > 0 || currentTags.length > 0 || currentSources.length > 0;

  return (
    <div className="mb-5 space-y-2">
      {/* Sort + Category row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Sort select */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 dark:text-gray-500">정렬</span>
          <select
            value={sort}
            onChange={(e) => changeSort(e.target.value)}
            className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-400"
          >
            <option value="date">최신순</option>
            <option value="score">중요도순</option>
          </select>
        </div>
      </div>

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

      {/* Source filter */}
      {availableSources.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gray-400 dark:text-gray-500 mr-1">출처</span>
          <button
            onClick={selectAllSources}
            disabled={allSourcesSelected}
            className={`text-xs px-2 py-0.5 rounded border transition-colors ${
              allSourcesSelected
                ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 border-gray-800 dark:border-gray-200 opacity-50 cursor-not-allowed'
                : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
          >
            전체선택
          </button>
          {availableSources.map((src) => (
            <button
              key={src}
              onClick={() => toggleSource(src)}
              className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                currentSources.includes(src)
                  ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 border-gray-800 dark:border-gray-200'
                  : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
            >
              {src}
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
          {currentSources.length > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              출처: {currentSources.join(', ')}
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
