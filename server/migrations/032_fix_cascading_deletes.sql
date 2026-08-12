-- Migration: 032_fix_cascading_deletes
-- Description: Changes ON DELETE CASCADE constraints to ON DELETE SET NULL for users

-- Questions table:
-- Drop existing constraints
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_recruiter_id_fkey;
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_created_by_fkey;
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_created_by_manager_id_fkey;

-- We also need to drop NOT NULL constraint on created_by if it exists
ALTER TABLE questions ALTER COLUMN created_by DROP NOT NULL;

-- Recreate constraints with SET NULL
ALTER TABLE questions ADD CONSTRAINT questions_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE questions ADD CONSTRAINT questions_created_by_manager_id_fkey FOREIGN KEY (created_by_manager_id) REFERENCES users(id) ON DELETE SET NULL;

-- Domains table:
ALTER TABLE domains DROP CONSTRAINT IF EXISTS domains_recruiter_id_fkey;
ALTER TABLE domains DROP CONSTRAINT IF EXISTS domains_created_by_manager_id_fkey;

ALTER TABLE domains ADD CONSTRAINT domains_recruiter_id_fkey FOREIGN KEY (recruiter_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE domains ADD CONSTRAINT domains_created_by_manager_id_fkey FOREIGN KEY (created_by_manager_id) REFERENCES users(id) ON DELETE SET NULL;

-- Assessments table:
ALTER TABLE assessments DROP CONSTRAINT IF EXISTS assessments_created_by_fkey;
ALTER TABLE assessments DROP CONSTRAINT IF EXISTS assessments_created_by_manager_id_fkey;

ALTER TABLE assessments ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE assessments ADD CONSTRAINT assessments_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE assessments ADD CONSTRAINT assessments_created_by_manager_id_fkey FOREIGN KEY (created_by_manager_id) REFERENCES users(id) ON DELETE SET NULL;

-- Manager assignments
-- Wait, if a manager is deleted, their assignments should probably be CASCADE or SET NULL. 
-- Since we want to keep recruiters, we should set manager_id to NULL.
ALTER TABLE manager_assignments DROP CONSTRAINT IF EXISTS manager_assignments_manager_id_fkey;
ALTER TABLE manager_assignments ADD CONSTRAINT manager_assignments_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE CASCADE;

-- If user_roles was ON DELETE CASCADE, it can remain CASCADE because roles are inherently tied to the user.
