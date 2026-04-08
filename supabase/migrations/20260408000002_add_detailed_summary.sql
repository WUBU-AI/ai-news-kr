-- Add detailed_summary column to articles table
-- Migration: 20260408000002_add_detailed_summary

ALTER TABLE articles ADD COLUMN IF NOT EXISTS detailed_summary TEXT;
