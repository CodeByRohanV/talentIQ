-- Migration 011: Add Employee ID
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50) UNIQUE;

-- Index for fast lookup by employee_id
CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);
