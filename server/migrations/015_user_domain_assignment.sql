-- Migration 015: User Domain Assignment
-- Implements domain-based scoping for users

-- 1. Add domain_id to users table to represent their assigned domain
ALTER TABLE users ADD COLUMN IF NOT EXISTS domain_id UUID REFERENCES domains(id) ON DELETE SET NULL;

-- 2. Index for better filtering
CREATE INDEX IF NOT EXISTS idx_users_domain_id ON users(domain_id);
