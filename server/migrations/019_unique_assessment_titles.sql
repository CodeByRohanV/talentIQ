-- Migration 019: Unique Assessment Titles per Tenant
-- This ensures that within the same organization, assessment titles must be unique.

DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'uq_assessments_tenant_title'
    ) THEN
        ALTER TABLE assessments 
        ADD CONSTRAINT uq_assessments_tenant_title UNIQUE (tenant_id, title);
    END IF;
END $$;
