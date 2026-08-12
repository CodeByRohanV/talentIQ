-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed existing tenants from users
INSERT INTO tenants (id, name)
SELECT DISTINCT tenant_id, 'skillz Tenant' 
FROM users 
WHERE tenant_id IS NOT NULL AND tenant_id != ''
ON CONFLICT (id) DO NOTHING;

-- Seed existing tenants from user_roles
INSERT INTO tenants (id, name)
SELECT DISTINCT tenant_id, 'skillz Tenant' 
FROM user_roles 
WHERE tenant_id IS NOT NULL AND tenant_id != ''
ON CONFLICT (id) DO NOTHING;

-- Update empty strings to NULL in users where applicable
UPDATE users SET tenant_id = NULL WHERE tenant_id = '';

-- Add foreign key constraint to users
ALTER TABLE users 
ADD CONSTRAINT fk_users_tenant 
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Add foreign key constraint to user_roles
ALTER TABLE user_roles
ADD CONSTRAINT fk_user_roles_tenant
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
