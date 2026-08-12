# Data Migration Script

This script provides SQL commands for migrating data from Supabase to PostgreSQL.

## Prerequisites

1. PostgreSQL database created: `aptitude_ace`
2. Schema migrations run: `server/migrations/001_initial_schema.sql`
3. Data exported from Supabase (see MIGRATION_GUIDE.md)

## Export from Supabase

Use Supabase SQL Editor to run these commands:

```sql
-- Export users (combine auth.users and profiles)
COPY (
  SELECT 
    u.id,
    u.email,
    p.full_name,
    p.company_name,
    u.created_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON u.id = p.user_id
) TO '/tmp/users_export.csv' WITH CSV HEADER;

-- Export questions
COPY (
  SELECT id, recruiter_id, domain, question_text, options::text, correct_answer, difficulty, created_at
  FROM public.questions
) TO '/tmp/questions_export.csv' WITH CSV HEADER;

-- Export assessments
COPY (
  SELECT id, recruiter_id, title, description, duration_minutes, 
         questions_config::text, thresholds::text, share_token, is_active, created_at, updated_at
  FROM public.assessments
) TO '/tmp/assessments_export.csv' WITH CSV HEADER;

-- Export candidates
COPY (
  SELECT id, assessment_id, name, email, share_token, status, started_at, completed_at, created_at
  FROM public.candidates
) TO '/tmp/candidates_export.csv' WITH CSV HEADER;

-- Export responses
COPY (
  SELECT id, candidate_id, question_id, selected_answer, is_flagged, answered_at
  FROM public.responses
) TO '/tmp/responses_export.csv' WITH CSV HEADER;

-- Export results
COPY (
  SELECT id, candidate_id, overall_score, domain_scores::text, passed, calculated_at
  FROM public.results
) TO '/tmp/results_export.csv' WITH CSV HEADER;

-- Export assessment_questions
COPY (
  SELECT assessment_id, question_id, question_order
  FROM public.assessment_questions
) TO '/tmp/assessment_questions_export.csv' WITH CSV HEADER;
```

## Import to PostgreSQL

**IMPORTANT:** Users will need to reset passwords as Supabase passwords cannot be migrated.

### Step 1: Create temporary password for all users

```sql
-- Connect to your PostgreSQL database
psql -U postgres -d aptitude_ace

-- Import users with temporary passwords
-- Note: All users will need to reset their passwords
CREATE TEMP TABLE temp_users (
  id UUID,
  email VARCHAR(255),
  full_name VARCHAR(255),
  company_name VARCHAR(255),
  created_at TIMESTAMP
);

\COPY temp_users FROM '/path/to/users_export.csv' WITH CSV HEADER;

-- Insert users with a temporary password hash
-- Users will need to use password reset functionality
INSERT INTO users (id, email, password_hash, full_name, company_name, created_at)
SELECT 
  id,
  email,
  '$2b$10$TEMPORARY_HASH_PLACEHOLDER_USERS_MUST_RESET', -- Temporary hash
  full_name,
  company_name,
  created_at
FROM temp_users;

DROP TABLE temp_users;
```

### Step 2: Import Questions

```sql
CREATE TEMP TABLE temp_questions (
  id UUID,
  recruiter_id UUID,
  domain VARCHAR(50),
  question_text TEXT,
  options TEXT,
  correct_answer INTEGER,
  difficulty VARCHAR(50),
  created_at TIMESTAMP
);

\COPY temp_questions FROM '/path/to/questions_export.csv' WITH CSV HEADER;

INSERT INTO questions (id, recruiter_id, domain, question_text, options, correct_answer, difficulty, created_at)
SELECT 
  id,
  recruiter_id,
  domain::question_domain,
  question_text,
  options::jsonb,
  correct_answer,
  difficulty,
  created_at
FROM temp_questions;

DROP TABLE temp_questions;
```

### Step 3: Import Assessments

```sql
CREATE TEMP TABLE temp_assessments (
  id UUID,
  recruiter_id UUID,
  title VARCHAR(255),
  description TEXT,
  duration_minutes INTEGER,
  questions_config TEXT,
  thresholds TEXT,
  share_token VARCHAR(255),
  is_active BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

\COPY temp_assessments FROM '/path/to/assessments_export.csv' WITH CSV HEADER;

INSERT INTO assessments (id, recruiter_id, title, description, duration_minutes, questions_config, thresholds, share_token, is_active, created_at, updated_at)
SELECT 
  id,
  recruiter_id,
  title,
  description,
  duration_minutes,
  questions_config::jsonb,
  thresholds::jsonb,
  share_token,
  is_active,
  created_at,
  updated_at
FROM temp_assessments;

DROP TABLE temp_assessments;
```

### Step 4: Import Candidates

```sql
\COPY candidates (id, assessment_id, name, email, share_token, status, started_at, completed_at, created_at) FROM '/path/to/candidates_export.csv' WITH CSV HEADER;
```

### Step 5: Import Responses

```sql
\COPY responses (id, candidate_id, question_id, selected_answer, is_flagged, answered_at) FROM '/path/to/responses_export.csv' WITH CSV HEADER;
```

### Step 6: Import Results

```sql
CREATE TEMP TABLE temp_results (
  id UUID,
  candidate_id UUID,
  overall_score INTEGER,
  domain_scores TEXT,
  passed BOOLEAN,
  calculated_at TIMESTAMP
);

\COPY temp_results FROM '/path/to/results_export.csv' WITH CSV HEADER;

INSERT INTO results (id, candidate_id, overall_score, domain_scores, passed, calculated_at)
SELECT 
  id,
  candidate_id,
  overall_score,
  domain_scores::jsonb,
  passed,
  calculated_at
FROM temp_results;

DROP TABLE temp_results;
```

### Step 7: Import Assessment Questions

```sql
\COPY assessment_questions (assessment_id, question_id, question_order) FROM '/path/to/assessment_questions_export.csv' WITH CSV HEADER;
```

## Verification

After import, verify data integrity:

```sql
-- Check counts
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'questions', COUNT(*) FROM questions
UNION ALL
SELECT 'assessments', COUNT(*) FROM assessments
UNION ALL
SELECT 'candidates', COUNT(*) FROM candidates
UNION ALL
SELECT 'responses', COUNT(*) FROM responses
UNION ALL
SELECT 'results', COUNT(*) FROM results
UNION ALL
SELECT 'assessment_questions', COUNT(*) FROM assessment_questions;

-- Check foreign key integrity
SELECT 
  'questions with invalid recruiter' as check_name,
  COUNT(*) as issues
FROM questions q
LEFT JOIN users u ON q.recruiter_id = u.id
WHERE u.id IS NULL

UNION ALL

SELECT 
  'assessments with invalid recruiter',
  COUNT(*)
FROM assessments a
LEFT JOIN users u ON a.recruiter_id = u.id
WHERE u.id IS NULL

UNION ALL

SELECT 
  'candidates with invalid assessment',
  COUNT(*)
FROM candidates c
LEFT JOIN assessments a ON c.assessment_id = a.id
WHERE a.id IS NULL;
```

## Post-Migration Steps

1. **Send Password Reset Emails:**
   - All users must reset their passwords
   - Use the backend's password reset functionality
   - Or manually create accounts for known users

2. **Verify Share Tokens:**
   - Ensure all assessment and candidate share tokens are preserved
   - Test existing assessment links

3. **Test Data Integrity:**
   - Verify question options are properly formatted as JSON
   - Check that all relationships are intact
   - Test the full user flow from login to test submission

4. **Backup:**
   - Create a backup of the PostgreSQL database
   - Keep Supabase instance active for rollback if needed

## Rollback

If issues arise:

```sql
-- Drop all tables and re-run schema migration
DROP TABLE IF EXISTS assessment_questions CASCADE;
DROP TABLE IF EXISTS results CASCADE;
DROP TABLE IF EXISTS responses CASCADE;
DROP TABLE IF EXISTS candidates CASCADE;
DROP TABLE IF EXISTS assessments CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TYPE IF EXISTS question_domain;

-- Then re-run: psql -U postgres -d aptitude_ace -f server/migrations/001_initial_schema.sql
```
