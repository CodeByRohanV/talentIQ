-- ============================================================
-- Migration 029: Add IP address to Test Attempts
-- ============================================================
-- This migration adds an ip_address column to track test takers
-- for security and auditing purposes.

ALTER TABLE test_attempts 
ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
