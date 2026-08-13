-- Migration: 033_add_update_cascade_and_fix_uuids
-- Description: Adds ON UPDATE CASCADE to all user foreign keys to properly support ID corrections, and fixes existing UUID users to use their employee_id.

-- 1. Drop all foreign keys that reference users(id)
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_created_by_fkey;
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_created_by_manager_id_fkey;
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_recruiter_id_fkey;
ALTER TABLE domains DROP CONSTRAINT IF EXISTS domains_recruiter_id_fkey;
ALTER TABLE domains DROP CONSTRAINT IF EXISTS domains_created_by_manager_id_fkey;
ALTER TABLE assessments DROP CONSTRAINT IF EXISTS assessments_created_by_fkey;
ALTER TABLE assessments DROP CONSTRAINT IF EXISTS assessments_created_by_manager_id_fkey;
ALTER TABLE assessments DROP CONSTRAINT IF EXISTS assessments_recruiter_id_fkey;
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_assigned_by_fkey;
ALTER TABLE manager_assignments DROP CONSTRAINT IF EXISTS manager_assignments_manager_id_fkey;
ALTER TABLE manager_assignments DROP CONSTRAINT IF EXISTS manager_assignments_recruiter_id_fkey;
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_created_by_fkey;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_manager_id_fkey;

-- 2. NOW safely change the column types from UUID to VARCHAR
ALTER TABLE users ALTER COLUMN id TYPE VARCHAR(255) USING id::VARCHAR;
ALTER TABLE users ALTER COLUMN manager_id TYPE VARCHAR(255) USING manager_id::VARCHAR;
ALTER TABLE questions ALTER COLUMN created_by TYPE VARCHAR(255) USING created_by::VARCHAR;
ALTER TABLE questions ALTER COLUMN created_by_manager_id TYPE VARCHAR(255) USING created_by_manager_id::VARCHAR;
ALTER TABLE domains ALTER COLUMN recruiter_id TYPE VARCHAR(255) USING recruiter_id::VARCHAR;
ALTER TABLE domains ALTER COLUMN created_by_manager_id TYPE VARCHAR(255) USING created_by_manager_id::VARCHAR;
ALTER TABLE assessments ALTER COLUMN created_by TYPE VARCHAR(255) USING created_by::VARCHAR;
ALTER TABLE assessments ALTER COLUMN created_by_manager_id TYPE VARCHAR(255) USING created_by_manager_id::VARCHAR;
ALTER TABLE user_roles ALTER COLUMN user_id TYPE VARCHAR(255) USING user_id::VARCHAR;
ALTER TABLE user_roles ALTER COLUMN assigned_by TYPE VARCHAR(255) USING assigned_by::VARCHAR;
ALTER TABLE manager_assignments ALTER COLUMN manager_id TYPE VARCHAR(255) USING manager_id::VARCHAR;
ALTER TABLE manager_assignments ALTER COLUMN recruiter_id TYPE VARCHAR(255) USING recruiter_id::VARCHAR;
ALTER TABLE roles ALTER COLUMN created_by TYPE VARCHAR(255) USING created_by::VARCHAR;

-- 3. Now re-add the constraints with ON UPDATE CASCADE
ALTER TABLE questions ADD CONSTRAINT questions_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE questions ADD CONSTRAINT questions_created_by_manager_id_fkey FOREIGN KEY (created_by_manager_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE domains ADD CONSTRAINT domains_recruiter_id_fkey FOREIGN KEY (recruiter_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE domains ADD CONSTRAINT domains_created_by_manager_id_fkey FOREIGN KEY (created_by_manager_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE assessments ADD CONSTRAINT assessments_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE assessments ADD CONSTRAINT assessments_created_by_manager_id_fkey FOREIGN KEY (created_by_manager_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE manager_assignments ADD CONSTRAINT manager_assignments_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE manager_assignments ADD CONSTRAINT manager_assignments_recruiter_id_fkey FOREIGN KEY (recruiter_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE roles ADD CONSTRAINT roles_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE users ADD CONSTRAINT users_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Automatically fix any existing users whose ID is a UUID
UPDATE users 
SET id = employee_id 
WHERE id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
AND employee_id LIKE '%_%';
