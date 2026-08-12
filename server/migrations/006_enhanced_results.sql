-- Migration to enhance test results stats
-- Wrapped in DO block for idempotency
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='results' AND column_name='total_questions') THEN
        ALTER TABLE results 
        ADD COLUMN total_questions INTEGER DEFAULT 0,
        ADD COLUMN attempted_questions INTEGER DEFAULT 0,
        ADD COLUMN correct_answers INTEGER DEFAULT 0,
        ADD COLUMN incorrect_answers INTEGER DEFAULT 0,
        ADD COLUMN unanswered_questions INTEGER DEFAULT 0;
    END IF;
END $$;

-- Optional: Add index safely
CREATE INDEX IF NOT EXISTS idx_results_candidate_id ON results(candidate_id);
