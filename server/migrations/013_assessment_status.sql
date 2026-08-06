-- Migration 013: Assessment Status
-- Add status column to assessments table and migrate is_active values

-- 1. Create ENUM for assessment status if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assessment_status') THEN
        CREATE TYPE assessment_status AS ENUM ('active', 'inactive', 'completed');
    END IF;
END$$;

-- 2. Add status column with default 'active'
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS status assessment_status DEFAULT 'active';

-- 3. Migrate existing is_active values
UPDATE assessments SET status = 'inactive' WHERE is_active = false;
UPDATE assessments SET status = 'active' WHERE is_active = true;

-- 4. Add index for status
CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status);
