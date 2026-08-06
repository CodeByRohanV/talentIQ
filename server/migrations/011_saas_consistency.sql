-- Migration to align schema with SaaS requirements
-- Add missing columns and indexes for assessments and questions

-- 1. Update assessments table
DO $$ 
BEGIN 
    -- Rename recruiter_id to created_by if it exists and created_by doesn't
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assessments' AND column_name = 'recruiter_id') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assessments' AND column_name = 'created_by') THEN
        ALTER TABLE assessments RENAME COLUMN recruiter_id TO created_by;
    END IF;

    -- Add tenant_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assessments' AND column_name = 'tenant_id') THEN
        ALTER TABLE assessments ADD COLUMN tenant_id UUID;
    END IF;

    -- Add created_by_role if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assessments' AND column_name = 'created_by_role') THEN
        ALTER TABLE assessments ADD COLUMN created_by_role VARCHAR(50);
    END IF;
END $$;

-- 2. Update questions table
DO $$ 
BEGIN 
    -- Rename recruiter_id to created_by if it exists and created_by doesn't
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'recruiter_id') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'created_by') THEN
        ALTER TABLE questions RENAME COLUMN recruiter_id TO created_by;
    END IF;

    -- Add tenant_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'tenant_id') THEN
        ALTER TABLE questions ADD COLUMN tenant_id UUID;
    END IF;
END $$;

-- 3. Backfill tenant_id from user_roles for existing records
UPDATE assessments a
SET tenant_id = (SELECT tenant_id FROM user_roles ur WHERE ur.user_id = a.created_by LIMIT 1)
WHERE a.tenant_id IS NULL;

UPDATE questions q
SET tenant_id = (SELECT tenant_id FROM user_roles ur WHERE ur.user_id = q.created_by LIMIT 1)
WHERE q.tenant_id IS NULL;

-- 4. Create Indexes for performance
CREATE INDEX IF NOT EXISTS idx_questions_tenant ON questions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assessments_tenant ON assessments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_manager_assignments_manager ON manager_assignments(manager_id);

