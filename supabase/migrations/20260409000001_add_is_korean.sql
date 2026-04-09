-- Add is_korean flag for Korean-language articles (skip translation, only summarize)
-- Migration: 20260409000001_add_is_korean

ALTER TABLE articles ADD COLUMN IF NOT EXISTS is_korean BOOLEAN NOT NULL DEFAULT FALSE;
