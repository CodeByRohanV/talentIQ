-- Migration 026: Map existing ADMIN users to SUPER_ADMIN
-- Fixes: tenant-onboarded users who had ADMIN role should get full SUPER_ADMIN access.
-- This also ensures SUPER_ADMIN has ALL permissions assigned in role_permissions.

-- Step 1: Remap global system ADMIN role assignments → SUPER_ADMIN
-- (Handles users assigned the global ADMIN role, tenant_id IS NULL)
UPDATE user_roles
SET role_id = (SELECT id FROM roles WHERE name = 'SUPER_ADMIN' AND tenant_id IS NULL)
WHERE role_id IN (SELECT id FROM roles WHERE name = 'ADMIN' AND tenant_id IS NULL);

-- Step 2: Remap tenant-specific ADMIN role assignments → global SUPER_ADMIN
-- (Handles users who were onboarded with a tenant-scoped ADMIN role)
UPDATE user_roles
SET role_id = (SELECT id FROM roles WHERE name = 'SUPER_ADMIN' AND tenant_id IS NULL)
WHERE role_id IN (SELECT id FROM roles WHERE name = 'ADMIN' AND tenant_id IS NOT NULL);

-- Step 3: Ensure SUPER_ADMIN role has ALL permissions in role_permissions
-- (Guards against any gaps from the migration 025 re-seed)
INSERT INTO role_permissions (role_id, permission_id)
    SELECT
        (SELECT id FROM roles WHERE name = 'SUPER_ADMIN' AND tenant_id IS NULL),
        p.id
    FROM permissions p
    ON CONFLICT DO NOTHING;
