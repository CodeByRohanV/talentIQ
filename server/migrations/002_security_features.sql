-- Migration: Add security settings and violation logging

-- 1. Add security_config to assessments
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS security_config JSONB DEFAULT '{
  "disableRightClick": false,
  "disableCopyPaste": false,
  "maxTabSwitchWarnings": 3,
  "fullscreenRequired": false,
  "autoSubmitOnViolation": false
}'::jsonb;

-- 2. Add access_token_hash to candidates
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS access_token_hash VARCHAR(255);

-- 3. Create test_violations table
CREATE TABLE IF NOT EXISTS test_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    violation_type VARCHAR(50) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_test_violations_candidate ON test_violations(candidate_id);
CREATE INDEX IF NOT EXISTS idx_test_violations_assessment ON test_violations(assessment_id);
