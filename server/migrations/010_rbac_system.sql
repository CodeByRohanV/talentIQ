-- Migration 010: RBAC System
-- Implementation of Role-Based Access Control

-- 1. Update Users Table
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT gen_random_uuid(); -- Default tenant for existing users

-- 2. Create Permissions Table
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Roles Table
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    tenant_id UUID NULL, -- NULL indicates a global system role
    is_system_role BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create Role-Permissions Junction Table
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY(role_id, permission_id)
);

-- 5. Create User-Roles Junction Table
CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY(user_id, role_id, tenant_id)
);

-- 6. Create Manager Assignments Table
CREATE TABLE IF NOT EXISTS manager_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manager_id UUID REFERENCES users(id) ON DELETE CASCADE,
    recruiter_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(manager_id, recruiter_id, tenant_id)
);

-- 7. Create Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    target_id UUID,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Performance Indexes (Part 13)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_tenant ON user_roles(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_permissions_code ON permissions(code);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_manager_assignments_manager ON manager_assignments(manager_id);
CREATE INDEX IF NOT EXISTS idx_manager_assignments_recruiter ON manager_assignments(recruiter_id);
