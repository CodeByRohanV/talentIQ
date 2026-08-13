-- Add is_deleted column for soft deletes
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- Create an index to speed up filtering of deleted users
CREATE INDEX IF NOT EXISTS idx_users_is_deleted ON users(is_deleted);
