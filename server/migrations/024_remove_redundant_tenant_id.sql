-- Migration 024: Remove Redundant tenant_id Columns
-- Dropping redundant tenant_id from tables referencing prefixed employee IDs

-- 1. Update manager_assignments
ALTER TABLE manager_assignments DROP CONSTRAINT IF EXISTS manager_assignments_manager_id_recruiter_id_tenant_id_key;
ALTER TABLE manager_assignments DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE manager_assignments ADD CONSTRAINT uq_manager_assignments_manager_recruiter UNIQUE (manager_id, recruiter_id);

-- 2. Update user_roles
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS fk_user_roles_tenant;
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_pkey;
ALTER TABLE user_roles DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE user_roles ADD PRIMARY KEY (user_id, role_id);

-- 3. Update assessments
ALTER TABLE assessments DROP CONSTRAINT IF EXISTS uq_assessments_tenant_title;
ALTER TABLE assessments DROP COLUMN IF EXISTS tenant_id;
CREATE UNIQUE INDEX uq_assessments_tenant_title ON assessments (split_part(created_by, '_', 1), title);

-- 4. Update questions
ALTER TABLE questions DROP COLUMN IF EXISTS tenant_id;

-- 5. Update domains
ALTER TABLE domains DROP COLUMN IF EXISTS tenant_id;

-- 6. Update users
ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_tenant;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_tenant_unique;
ALTER TABLE users DROP COLUMN IF EXISTS tenant_id;
CREATE UNIQUE INDEX users_email_tenant_unique ON users (email, split_part(id, '_', 1));
