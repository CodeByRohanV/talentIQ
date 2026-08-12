-- ============================================================
-- Migration 030: Add Photo ID Capture Fields
-- ============================================================
-- This migration adds a flag to assessments to require a photo ID
-- and a column to test_attempts to store the captured photo URL.

ALTER TABLE assessments 
ADD COLUMN IF NOT EXISTS requires_photo_id BOOLEAN DEFAULT false;

ALTER TABLE test_attempts 
ADD COLUMN IF NOT EXISTS photo_id_url VARCHAR(255);
