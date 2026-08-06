-- Soft deletion for questions
-- This preserves question data for historical assessment reports even after
-- a recruiter "deletes" questions from the question bank.

-- Add soft-delete columns to questions table
ALTER TABLE questions
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Index for fast filtering of live (non-deleted) questions
CREATE INDEX IF NOT EXISTS idx_questions_is_deleted ON questions(is_deleted) WHERE is_deleted = false;
