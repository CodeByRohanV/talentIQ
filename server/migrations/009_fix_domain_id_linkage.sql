-- Fix domain_id linkage for questions
-- Migration 008 had a bug: the final UPDATE only matched questions where
-- q.recruiter_id = d.recruiter_id, but global/default domains have 
-- recruiter_id IS NULL, so questions were never linked.

-- Step 1: Link questions to GLOBAL domains (recruiter_id IS NULL) by matching slug
UPDATE questions q
SET domain_id = d.id
FROM domains d
WHERE q.domain::TEXT = d.slug
  AND d.recruiter_id IS NULL
  AND q.domain_id IS NULL;

-- Step 2: For any remaining questions, try recruiter-specific domains
UPDATE questions q
SET domain_id = d.id
FROM domains d
WHERE q.domain::TEXT = d.slug
  AND d.recruiter_id = q.recruiter_id
  AND q.domain_id IS NULL;

-- Step 3: Create index on domain_id for faster filtering
CREATE INDEX IF NOT EXISTS idx_questions_domain_id ON questions(domain_id);
