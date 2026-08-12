-- ============================================================
-- Migration 005: Test Attempts & Randomization Architecture
-- ============================================================
-- This migration introduces the test_attempts table which stores
-- per-candidate randomized question and option orders. The design
-- ensures:
--   1. Each candidate gets a unique, stable shuffle on first load.
--   2. Shuffles are idempotent (refresh/reconnect returns same order).
--   3. Correct answers are NEVER stored in the randomized structure
--      exposed to the frontend — only display-order mappings.
--   4. The table is indexed for high-concurrency read performance.
-- ============================================================

-- Enable pgcrypto if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------
-- test_attempts table
-- ---------------------------------------------------------------
-- randomized_question_order: ordered array of question UUIDs
--   e.g. ["uuid-q3", "uuid-q1", "uuid-q2"]
--
-- randomized_option_order: map of question_id -> shuffled option indices
--   e.g. { "uuid-q1": [2, 0, 3, 1], "uuid-q3": [1, 3, 0, 2] }
--   This tells the frontend: "show option at index 2 first, then 0..."
--   The backend uses the INVERSE of this map to evaluate answers.
--
-- attempt_status: 'pending' | 'in_progress' | 'completed' | 'expired' | 'abandoned'
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS test_attempts (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id                UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    assessment_id               UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,

    -- Randomized structures (set once on first start, never mutated)
    randomized_question_order   JSONB NOT NULL DEFAULT '[]',
    randomized_option_order     JSONB NOT NULL DEFAULT '{}',

    -- Attempt lifecycle
    attempt_status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                                    CHECK (attempt_status IN ('pending','in_progress','completed','expired','abandoned')),

    -- Timing
    started_at                  TIMESTAMP WITH TIME ZONE,
    completed_at                TIMESTAMP WITH TIME ZONE,
    expires_at                  TIMESTAMP WITH TIME ZONE,   -- computed: started_at + duration

    -- Metadata for observability
    created_at                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- One active attempt per candidate per assessment.
    -- If a candidate retakes (if allowed), the old attempt is marked 'abandoned'.
    CONSTRAINT uq_candidate_assessment_attempt UNIQUE (candidate_id, assessment_id)
);

-- ---------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------
-- Primary lookup: fetch attempt by candidate + assessment (idempotency check)
CREATE INDEX IF NOT EXISTS idx_attempts_candidate_assessment
    ON test_attempts (candidate_id, assessment_id);

-- Status-based queries (e.g. find all in_progress attempts for monitoring)
CREATE INDEX IF NOT EXISTS idx_attempts_status
    ON test_attempts (attempt_status)
    WHERE attempt_status IN ('in_progress', 'pending');

-- Assessment-level analytics (how many attempts per assessment)
CREATE INDEX IF NOT EXISTS idx_attempts_assessment
    ON test_attempts (assessment_id);

-- Expiry sweeper job: find expired in_progress attempts
CREATE INDEX IF NOT EXISTS idx_attempts_expires_at
    ON test_attempts (expires_at)
    WHERE attempt_status = 'in_progress';

-- ---------------------------------------------------------------
-- Auto-update updated_at trigger
-- ---------------------------------------------------------------
DROP TRIGGER IF EXISTS update_test_attempts_updated_at ON test_attempts;
CREATE TRIGGER update_test_attempts_updated_at
    BEFORE UPDATE ON test_attempts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------
-- Expire stale in_progress attempts (run periodically via cron or pg_cron)
-- This is a helper function — call it from a scheduled job.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION expire_stale_attempts()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE test_attempts
    SET attempt_status = 'expired', updated_at = NOW()
    WHERE attempt_status = 'in_progress'
      AND expires_at IS NOT NULL
      AND expires_at < NOW();

    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------
-- DESIGN NOTES
-- ---------------------------------------------------------------
-- Q: Why JSONB and not a separate normalized table?
-- A: For a read-heavy, write-once pattern (shuffle is generated once
--    and read many times), JSONB in a single row is optimal. It avoids
--    N+1 joins and keeps the shuffle retrieval to a single indexed PK
--    lookup. A normalized table (attempt_question_order) would require
--    a JOIN and ORDER BY on every question fetch, adding latency at scale.
--
-- Q: Caching strategy?
-- A: The randomized_question_order and randomized_option_order are
--    immutable after creation. They are safe to cache in Redis with
--    key: "attempt:{attempt_id}:order" and a TTL equal to the test
--    duration + 30 minutes. On cache miss, fall back to DB.
--
-- Q: Partitioning for large scale?
-- A: Partition test_attempts by RANGE on created_at (monthly partitions)
--    once the table exceeds ~10M rows. Use pg_partman for automation.
--    Example:
--      CREATE TABLE test_attempts_2026_02 PARTITION OF test_attempts
--      FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
