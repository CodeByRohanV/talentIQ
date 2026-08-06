-- Add tenant_id and created_by_manager_id to domains table for proper scoping
ALTER TABLE domains ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE domains ADD COLUMN IF NOT EXISTS created_by_manager_id UUID;

-- Backfill existing domains
-- Standard domains (recruiter_id IS NULL) are global for now, or we could leave them as null tenant_id
-- Custom domains (recruiter_id IS NOT NULL) get their tenant_id and manager_id from the user who created them
UPDATE domains d
SET tenant_id = u.tenant_id,
    created_by_manager_id = u.manager_id
FROM users u
WHERE d.recruiter_id = u.id
AND d.recruiter_id IS NOT NULL;

-- For managers who created domains (if any), the recruiter_id is their own id
-- If they are managers, created_by_manager_id should be their own id if we follow the same pattern
UPDATE domains d
SET created_by_manager_id = u.id
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE d.recruiter_id = u.id
AND r.name = 'MANAGER';
