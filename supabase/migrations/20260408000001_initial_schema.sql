-- AI 뉴스 큐레이션 사이트 초기 스키마
-- Migration: 20260408000001_initial_schema

-- articles: 수집된 뉴스 기사
CREATE TABLE IF NOT EXISTS articles (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  source_url        TEXT UNIQUE NOT NULL,
  source_name       TEXT NOT NULL,
  original_title    TEXT NOT NULL,
  original_content  TEXT,
  translated_title  TEXT,
  summary_bullets   TEXT[] DEFAULT '{}',
  importance_score  FLOAT DEFAULT 0,
  category          TEXT,
  tags              TEXT[] DEFAULT '{}',
  published_at      TIMESTAMPTZ,
  collected_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  is_featured       BOOLEAN DEFAULT FALSE,
  view_count        INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS articles_collected_at_idx ON articles (collected_at DESC);
CREATE INDEX IF NOT EXISTS articles_importance_score_idx ON articles (importance_score DESC);
CREATE INDEX IF NOT EXISTS articles_is_featured_idx ON articles (is_featured);
CREATE INDEX IF NOT EXISTS articles_category_idx ON articles (category);

-- settings: 앱 설정 키-값 저장소
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- collection_logs: 뉴스 수집 실행 로그
CREATE TABLE IF NOT EXISTS collection_logs (
  id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  run_at               TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  sources_checked      INTEGER DEFAULT 0,
  articles_collected   INTEGER DEFAULT 0,
  articles_translated  INTEGER DEFAULT 0,
  status               TEXT DEFAULT 'success' CHECK (status IN ('success', 'failed', 'partial')),
  error_message        TEXT
);

CREATE INDEX IF NOT EXISTS collection_logs_run_at_idx ON collection_logs (run_at DESC);

-- 기본 설정값 삽입
INSERT INTO settings (key, value) VALUES
  ('rss_sources', '[]'),
  ('openai_model', 'gpt-4o-mini'),
  ('max_articles_per_run', '50'),
  ('importance_threshold', '0.5')
ON CONFLICT (key) DO NOTHING;
