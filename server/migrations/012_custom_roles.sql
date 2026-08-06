-- Migration 012: Custom Roles and Granular Permissions

-- 1. Upgrade Roles Table
ALTER TABLE roles ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE roles ALTER COLUMN is_system_role SET DEFAULT TRUE;

-- 2. Ensure Permissions table has all atomic capabilities
INSERT INTO permissions (code, description) VALUES
-- ASSESSMENTS
('create_assessment', 'Can create new assessments'),
('edit_assessment', 'Can edit existing assessments'),
('delete_assessment', 'Can delete assessments'),
('publish_assessment', 'Can publish/activate assessments'),
-- QUESTIONS
('create_question', 'Can add questions to the bank'),
('edit_question', 'Can edit questions in the bank'),
('delete_question', 'Can remove questions from the bank'),
('view_question_bank', 'Can view the organizational question bank'),
-- CANDIDATES
('view_candidates', 'Can view candidate lists'),
('manage_candidates', 'Can add/edit/remove candidates'),
-- DOMAINS
('create_domain', 'Can create new question domains'),
('edit_domain', 'Can edit domain names'),
('delete_domain', 'Can delete domains'),
-- USERS & ROLES
('invite_users', 'Can invite new users to the tenant'),
('assign_roles', 'Can assign roles to users'),
('manage_roles', 'Can create and modify custom roles'),
-- REPORTS
('view_reports', 'Can view analytics reports'),
('export_reports', 'Can export data reports'),
-- ADMIN
('manage_settings', 'Can manage tenant-level settings')
ON CONFLICT (code) DO NOTHING;

-- 3. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_roles_tenant ON roles(tenant_id);

-- 4. Assign Admin all permissions if they don't have them
DO $$
DECLARE
    admin_role_id UUID;
    permission_record RECORD;
BEGIN
    -- For each tenant, ensure ADMIN role has all permissions
    FOR admin_role_id IN (SELECT id FROM roles WHERE name = 'ADMIN') LOOP
        FOR permission_record IN (SELECT id FROM permissions) LOOP
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (admin_role_id, permission_record.id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;
END $$;
