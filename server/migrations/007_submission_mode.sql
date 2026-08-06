-- Migration to distinguish submission modes
-- Wrapped in DO block for idempotency
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='results' AND column_name='submission_mode') THEN
        ALTER TABLE results 
        ADD COLUMN submission_mode VARCHAR(20) DEFAULT 'manual';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='test_attempts' AND column_name='submission_mode') THEN
        ALTER TABLE test_attempts 
        ADD COLUMN submission_mode VARCHAR(20) DEFAULT 'manual';
    END IF;
END $$;

-- Comment explaining the column usage
COMMENT ON COLUMN results.submission_mode IS 'Submission source: manual (user clicked submit) or auto (timer expired)';
