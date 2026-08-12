-- Migration 017: Assessment Expiry
-- Add expires_at column to assessments for automatic completion

ALTER TABLE assessments ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- For existing assessments, if they are active, we don't know when they should expire.
-- We'll leave them as NULL, but we can set a default for new ones in logic.
